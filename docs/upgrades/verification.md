# U6 verification — measured performance and regression evidence

Recorded **2026-10-25** on Windows 10 / Node `v24.11.1` / PostgreSQL 16 via Compose host port **5434**. Disposable databases only; development database name `reviewdock` was never reset by helpers. Raw plan and timing artifact: [`perf-raw.json`](perf-raw.json).

## Environment and dataset

| Item                   | Value                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| Postgres               | `127.0.0.1:5434` (Compose `assignment-postgres-1`)                                          |
| Disposable perf DB     | `reviewdock_u6_perf_check` (created, measured, dropped)                                     |
| Synthetic corpus       | 20 students × 40 submissions = **800** rows; mixed PENDING/APPROVED/REJECTED (~3/5 pending) |
| API under test         | Express app on ephemeral port inside `perf:check`                                           |
| Client build inspected | `next build --webpack` output under `apps/web/.next`                                        |
| Browser automation     | Playwright Chromium through the Next.js `/api` proxy                                        |

Timings below are **warm-path, machine-local** observations after one priming request per endpoint. They are not latency SLAs.

## Commands and results

Run sequentially from the repository root (after clearing any accidental `DATABASE_URL` override in the shell — a leftover `127.0.0.1:1` probe URL must not shadow `apps/api/.env`):

| Command                     | Result                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run check`             | Pass (format, lint, typecheck)                                                                |
| `npm run build`             | Pass (API `tsc` + Next production build)                                                      |
| `npm run db:check`          | Pass (disposable `reviewdock_phase2_check`; 3 migrations including `submissions_created_idx`) |
| `npm run auth:check`        | Pass                                                                                          |
| `npm run submissions:check` | Pass                                                                                          |
| `npm run reviews:check`     | Pass                                                                                          |
| `npm run demo:check`        | Pass (DEMO_MODE on + off paths; demo credentials absent when disabled)                        |
| `npm run perf:check`        | Pass — writes `docs/upgrades/perf-raw.json`                                                   |
| `npm run test:e2e`          | **20 passed** (Chromium, ~50.5s)                                                              |

Smoke (separate from the suite):

| Probe                                                       | Result                                               |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| `GET http://127.0.0.1:3000/`                                | 200, title `ReviewDock`                              |
| `GET http://127.0.0.1:4000/api/health`                      | 200 `{"status":"ok","service":"reviewdock-api"}`     |
| `GET http://127.0.0.1:3000/api/health` (proxied)            | 200 same body                                        |
| Health with `DATABASE_URL` → `127.0.0.1:1` (API on `:4011`) | 200 same body (liveness does not require PostgreSQL) |

Helpers refuse non-`reviewdock_*_check` / non-allowlisted demo DB names before connecting (`e2e/db-safety.spec.ts`, demo/perf guards). Suites drop their disposable DBs on success and failure. No process was killed to free ports.

GitHub Actions was **not** observed on a remote (no delivery push in U6).

## Measured database / API findings

### Indexes inspected

Present before U6: `submissions_owner_created_idx`, `submissions_status_created_idx`, unique `canonical_repository_url`.

**Defect / opportunity (measured):** mentor `status=ALL` newest page planned as **Seq Scan + top-N sort** on the 800-row corpus (~0.46 ms execution in the pre-index capture).

**Fix:** forward migration `20261025140000_submissions_created_idx` — `(created_at DESC, id DESC)`.

**After:** `Index Only Scan using submissions_created_idx` (~0.06 ms warm execution in `perf-raw.json`).

### Representative EXPLAIN (ANALYZE) — warm

| Workload                        | Plan summary                                                 | Dominant scan                               |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| Owner list page                 | `Index Only Scan` `submissions_owner_created_idx` + `Limit`  | Index                                       |
| Owner status filter             | `Index Scan` `submissions_status_created_idx` + owner filter | Index                                       |
| Owner contains-search           | Owner index + `ILIKE` filter on name/URL                     | Index + filter                              |
| Mentor PENDING page             | `Index Only Scan` `submissions_status_created_idx`           | Index                                       |
| Mentor ALL newest               | `Index Only Scan` `submissions_created_idx`                  | Index (**after** migration)                 |
| Mentor unscoped contains-search | Seq Scan submissions + hash join users + sort                | Seq (expected for leading-wildcard `ILIKE`) |
| Global status `groupBy` (stats) | Seq Scan + HashAggregate over 800 rows (~0.27 ms)            | Seq — acceptable at this size               |

No trigram/extension or search service was added: contains-search still seq-scans at 800 rows (~2.3 ms plan execution). A normal B-tree would not accelerate `%term%` patterns.

### API payloads / bounds (warm)

| Endpoint                                 | Rows returned | Bytes (approx) | Elapsed (ms) |
| ---------------------------------------- | ------------- | -------------- | ------------ |
| `GET /api/submissions/mine` defaults     | 10            | 6.4 KB         | 10.4         |
| mine `pageSize=50` (owner has 40)        | 40            | 25 KB          | 10.5         |
| mine search `q`                          | 10            | 6.4 KB         | 12.5         |
| mentor queue PENDING / ALL `pageSize=10` | 10            | ~3.4 KB        | 8–9          |
| mentor search                            | 10            | ~3.4 KB        | 17           |
| mentor stats                             | n/a           | 67 B           | 5.5          |
| submission detail by id                  | 1             | 662 B          | 9.2          |

Lists remain bounded by validated `page`/`pageSize`. Filtering, counting, and pagination execute in PostgreSQL (no complete-queue client filter). Queue rows stay compact (U5); descriptions load via detail. Deterministic `created_at DESC, id DESC` ordering preserved.

### Query-count improvement (owner stats)

**Before:** `getMySubmissionStats` issued four separate `count` queries.  
**After:** one `groupBy` by `status`. Same independent-of-filter totals contract; covered by existing `submissions:check` / student e2e.

## Frontend efficiency

| Check                                 | Observation                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Production JS (`.next/static/chunks`) | ~1.31 MB uncompressed across chunks; largest `framework` ~219 KB, `main` ~132 KB; mentor page chunk ~22 KB; student list ~2.6 KB; detail ~7.4 KB |
| Fonts                                 | Two self-hosted Manrope `.woff2` files (~40 KB total)                                                                                            |
| Secrets / server deps in client       | `findstr` over static chunks: no `passwordHash`, `JWT_SECRET`, `DATABASE_URL`, or Prisma client imports                                          |
| Duplicate fetches                     | Mentor + project list stores keep in-flight promises and sequence counters; account change invalidates caches (`auth-context`)                   |
| Stale responses / cleanup             | Sequence gates discard older responses; draft debounce generation-gated; no demonstrated timer leak in e2e navigation                            |
| Unbounded render                      | Server pagination + pageSize caps; long text covered in a11y e2e                                                                                 |

No additional frontend rewrite was required beyond evidence already established in U4/U5 stores.

## Authentication and data-boundary regression

Re-verified by `auth:check`, `submissions:check`, `reviews:check`, `demo:check`, and proxy/trust e2e (not re-listed assertion-by-assertion here). Coverage includes signup/login, email normalize + concurrent duplicate signup, bcrypt 72-byte policy, JWT alg/iss/aud/sub/exp, missing/expired/tampered tokens, DB role reload and deleted-user sessions, cookie attributes/clearing, failed logout + open-workspace expiry, Origin (missing/null/malformed/untrusted), XFF spoofing vs rate buckets, ownership isolation, privileged-field injection, repository races, concurrent mentor decisions/rollback. Public responses do not expose passwords, hashes, JWTs, secrets, stack traces, or internal DB errors in these suites.

## Browser and accessibility

| Layer                           | Coverage                                                                                                                                                                                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playwright Chromium (automated) | 20 tests: public a11y/keyboard/dialog/mobile, demo panel on/off paths, drafts/search/checkpoints, full student→mentor lifecycle, mentor detail/409/refresh failure, student search/filter/page/details/retry, session failure, proxy trust/resilience, DB helper safety |
| Manual visual inspection        | Not re-run as a separate U6 pass beyond confirming homepage 200 and existing screenshots from U2–U5                                                                                                                                                                     |
| Untested                        | Firefox/WebKit/Safari, real screen readers (NVDA/VoiceOver), multi-tab load races, multi-instance rate-limit memory, production TLS cookie Secure path on a public host                                                                                                 |

## Defects and fixes in U6

1. **Mentor ALL / newest path Seq Scan** — justified `submissions_created_idx`; before/after plans in `perf-raw.json`.
2. **Owner stats N× count** — single `groupBy` (request-count reduction; same totals semantics).
3. **Formatting / ignore** — Prettier ignore for local `docs/videos` so unrelated lesson assets do not block `check`.

No brittle hardware latency thresholds were asserted. Search remains intentionally unextended.

## Remaining limitations

- Contains-search (`ILIKE '%q%'`) will stay sequential without a justified extension or redesign; not claimed fixed.
- Global mentor stats still scan status aggregates (fine at hundreds of rows; revisit only with evidence at larger scale).
- In-memory rate limits are single-process (documented historically).
- GitHub remote push, observed Actions CI, authorized public deployment, and Part 2 videos remain open (U7 / external inputs).
- U6 did not claim production readiness from a build alone; evidence is the measured suite above.
