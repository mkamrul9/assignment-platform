# U1 baseline — requirement coverage and quality audit

Recorded against the working tree after the U1 audit. Evidence is local code, integration checks, and Chromium e2e unless stated otherwise. Enhancement plans (U2–U7) are not assessment requirements.

## External delivery (separate from application functionality)

| Item                            | Status                             | Evidence                                                              |
| ------------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| Application Part 1 features     | Implemented; see coverage below    | Code + local suites                                                   |
| GitHub repository reachability  | Open                               | No `git remote` configured; push not observed                         |
| Observed GitHub Actions CI      | Open                               | Workflow present (`.github/workflows/ci.yml`); no remote run observed |
| Production deployment readiness | Documented; not verified on a host | `docs/operations.md`; no authorized target exercised                  |
| Part 2 video lessons            | Open                               | Detailed lesson instructions not supplied                             |

## Stack requirement coverage

| Requirement         | Implementation                                        | Assertions / verification                      |
| ------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| TypeScript          | Strict TS in `apps/*`, `tsconfig.tooling.json`        | `npm run check` (typecheck + lint)             |
| Next.js             | `apps/web` App Router, Next 16.4.2, Webpack           | `npm run build`, Playwright through Next proxy |
| Tailwind CSS        | Tailwind 4 + `globals.css`                            | Build / e2e render                             |
| shadcn/ui           | `components.json`, `apps/web/src/components/ui/*`     | Mentor table / dialogs in e2e                  |
| Express             | `apps/api` Express 5                                  | Integration suites hit Express directly        |
| PostgreSQL + Prisma | Compose Postgres 16, Prisma 7, shared client          | `db:check` + feature suites on disposable DBs  |
| JWT RBAC            | `jose` HS256 cookie sessions; Express role middleware | `auth:check`, role-boundary routes, e2e login  |

## Feature requirement coverage

| Requirement                                          | Implementation                                   | Test evidence                                                 | Gap                                     |
| ---------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------- |
| Student form: name, repo URL, live link, description | `submission-form.tsx` + `POST /api/submissions`  | `submissions:check`, `lifecycle` e2e                          | None for Part 1                         |
| Server validation + duplicate protection             | Zod schemas; canonical URL + unique constraint   | Invalid payloads, cross-student duplicate, concurrent 201+409 | None                                    |
| Submission rate limit                                | 5 / 10 min / student id                          | `submissions:check` 429 + `retryAfterSeconds`                 | In-memory / single process (documented) |
| Mentor paginated table                               | Queue UI + `GET /api/reviews/submissions`        | `reviews:check`, mentor e2e                                   | None                                    |
| Server-side approved/rejected filters                | `status` query in PostgreSQL                     | Filter totals/rows in `reviews:check`                         | None                                    |
| Global statistics                                    | `GET /api/reviews/stats` independent of filters  | Stats vs filters in `reviews:check` / e2e                     | None                                    |
| Approve / reject actions                             | Decision endpoint + dialog; rejection note rules | Decision, conflict, rollback in `reviews:check`; e2e          | None                                    |
| JWT role-based auth                                  | Cookie JWT; DB role on each request              | JWT claims, cookies, roles, Origin in `auth:check`            | Fixed: login bcrypt 72-byte gap (below) |
| Student signup + seeded mentor                       | Signup → `STUDENT`; seed → `MENTOR`              | Signup/login in `auth:check`; seed in `db:check`              | None                                    |

## Correctness / security audit summary

Covered by existing assertions (and still holding after U1): current DB user lookup for sessions; deleted-user → 401; ownership isolation on `/mine`; forged role/ownership/status/reviewer/timestamp fields rejected; email normalize + concurrent signup; JWT alg/iss/aud/exp/sub; cookie HttpOnly/SameSite/Path/Secure-off-in-dev; logout clear; failed-logout UI honesty (e2e); trusted Origin; spoofed XFF stripped at Next; rate-limit identity + Retry-After; repository canonicalization + concurrent duplicates; server filter/order/pagination/global counts; concurrent decisions + transaction rollback; account-scoped cache reset; proxy 502/504 contracts.

### Defects found and fixed in U1

1. **Login accepted bcrypt-truncated over-long passwords**  
   Signup enforced the 72 UTF-8-byte bcrypt limit; login only required a non-empty password. `bcryptjs.compare` truncates to 72 bytes, so a longer password sharing the stored prefix authenticated.  
   **Fix:** reject >72-byte passwords in `loginSchema`; `verifyPassword` returns false above the limit; `hashPassword` re-checks policy.  
   **Regression:** `auth:check` signup over-long → 400; exact 72 → login 200; 72+suffix → 400.

2. **Current-role assertion gap (coverage only)**  
   Middleware already reloads the user (including role) from PostgreSQL. Added an explicit promote/demote assertion in `auth:check` so role changes mid-session are locked in.

3. **Mentor queue out-of-range page vs URL / Prev–Next**  
   The store could recover an empty high page to `totalPages` while the URL stayed on the requested page, so Previous/Next stepped from the stale URL page.  
   **Fix:** sync the queue URL when recovered `pagination.page` differs from the URL page; Prev/Next use `pagination.page`.

## Performance baseline (U1)

Larger optimization is deferred to U6. Student browse/detail work is deferred to U4/U5.

| Topic                          | Finding                                                                                                                       | Measured?                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /api/submissions/mine`    | **U4:** bounded `page`/`pageSize`/`status`/`q` with PostgreSQL pagination; index `submissions_owner_created_idx` remains      | U4 contract verified in `submissions:check` / e2e; large-scale timing still **unmeasured** (U6) |
| Mentor queue payload           | **U5:** compact list select; full description/review loaded on demand via detail API                                          | U5 verified in `reviews:check` / mentor e2e; large-scale timing still **unmeasured** (U6)       |
| Duplicate / render fetching    | Mentor + project stores dedupe via promise + request sequence; subscribe triggers load                                        | Code review only; no duplicate-network capture in U1                                            |
| Stale / out-of-order responses | Sequence counters discard older responses; draft timers generation-gated                                                      | Covered by design + existing failure e2e paths                                                  |
| Count/page consistency         | Stats separate from filtered queue; out-of-range page → empty rows + stable meta; client may retry last page after mutation   | Integration assertions exist; no load race measurement                                          |
| Indexes / plans                | Owner and status+createdAt indexes present; search uses `contains` ILIKE-style filters (not index-friendly for arbitrary `q`) | **Unmeasured** `EXPLAIN`; search cost labeled risk for large tables                             |
| Proxy client IP                | Default: Next strips caller forwarding headers; shared Next→Express peer bucket. Opt-in `TRUST_INGRESS_CLIENT_IP`             | e2e `proxy-trust` covers forged XFF; production ingress path unverified                         |

## Requested product direction (not missing brief requirements)

Documented for later phases: ink-blue / neutral / restrained amber palette; self-hosted Manrope; shared navbar/footer; opt-in isolated public demo with synthetic accounts; bounded student browsing + authorized project details; keep drafts, search, checkpoints, and immutable review decisions.

## Verification commands (U1)

Run sequentially from the repository root (disposable DBs / synthetic accounts; suites clean up on failure). Observed on this machine (PostgreSQL via Compose host port **5434**):

| Command                     | Result                                                      |
| --------------------------- | ----------------------------------------------------------- |
| `npm run check`             | Passed (format, lint, typecheck)                            |
| `npm run build`             | Passed (API `tsc` + Next.js webpack production build)       |
| `npm run db:check`          | Passed (disposable `reviewdock_phase2_check`)               |
| `npm run auth:check`        | Passed (includes bcrypt 72-byte + current-role regressions) |
| `npm run submissions:check` | Passed                                                      |
| `npm run reviews:check`     | Passed                                                      |
| `npm run test:e2e`          | Passed (13 Chromium tests)                                  |

### External blockers still open

- No git remote; GitHub push / signed-out reachability not verified
- CI workflow present but no observed GitHub Actions run
- No authorized production deployment exercised
- Part 2 video lesson instructions not supplied
