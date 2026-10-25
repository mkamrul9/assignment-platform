# U7 delivery status

Recorded **2026-10-25**. Local documentation, reproducibility, CI configuration, and verification are complete. External GitHub reachability, observed Actions, public visibility, hosted deployment, and Part 2 videos remain **open** until their inputs exist.

## Requirements vs optional enhancements

| Kind                  | Items                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Part 1 requirements   | TS workspaces; Next/Tailwind/shadcn; Express; PostgreSQL/Prisma; JWT RBAC; student submit + validation/duplicates/rate limit; mentor paginated queue + server filters + stats + decisions; student signup + seeded mentor |
| Optional enhancements | Drafts; mentor search; checkpoints; student browse/details; mentor on-demand detail/409 recovery; demo sandbox; `submissions_created_idx`; `perf:check`                                                                   |

## Exact setup commands

Normal app (Bash or PowerShell after copying env examples and setting `JWT_SECRET` / `MENTOR_*`):

```sh
npm ci --include=dev
npm run db:up
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Demo sandbox (separate `reviewdock_demo*` DB, never `reviewdock`):

```sh
cp apps/api/.env.demo.example apps/api/.env.demo
cp apps/web/.env.demo.example apps/web/.env.demo.local
npm run demo:prepare
npm run demo:dev
```

## Tests run (this machine)

| Command                     | Result                                          |
| --------------------------- | ----------------------------------------------- |
| `npm run check`             | Pass                                            |
| `npm run build`             | Pass                                            |
| `npm run db:check`          | Pass                                            |
| `npm run auth:check`        | Pass                                            |
| `npm run submissions:check` | Pass                                            |
| `npm run reviews:check`     | Pass                                            |
| `npm run demo:check`        | Pass (enabled + disabled paths)                 |
| `npm run test:e2e`          | Pass (20 Chromium tests; refreshes screenshots) |

Homepage / direct / proxied health: exercised during U6/U7 smokes. Health remains 200 with unreachable PostgreSQL (U6). Performance evidence: [verification.md](verification.md).

## Fresh-install verification

Isolated copy under `reviewdock-u7-fresh` (no reused `node_modules` / `.next`):

1. Env from examples only → disposable `reviewdock_u7_fresh` on Compose Postgres **5434**
2. `npm ci --include=dev` → `db:generate` → `db:migrate:deploy` → `db:seed` → `npm run build`
3. Production start (`NODE_ENV=production` web on `:3020`, API on `:4020`) → student signup → submit → mentor approve → student detail `APPROVED`
4. Demo: `demo:prepare` + repeated `demo:seed` on `reviewdock_demo_u7_fresh` (idempotent)
5. Dropped disposable DBs; removed temp tree; development `reviewdock` DB/volumes preserved

**Note:** shell-exported `DATABASE_URL` / `WEB_ORIGINS` / nonstandard `NODE_ENV` must not shadow `.env` during install or Next production builds.

## Screenshots

Captured from Playwright against the real proxied app (synthetic data):

- `docs/screenshots/public-home.png`
- `docs/screenshots/auth-signup.png`
- `docs/screenshots/demo-account-selection.png`
- `docs/screenshots/student-empty.png`
- `docs/screenshots/student-mobile.png`
- `docs/screenshots/student-submit-success.png`
- `docs/screenshots/student-projects.png`
- `docs/screenshots/student-project-detail.png`
- `docs/screenshots/mentor-queue.png`
- `docs/screenshots/mentor-review-dialog.png`

Manual visual inspection: Chromium e2e covers desktop and 390px paths; separate screen-reader / Firefox / WebKit passes were not run.

## CI configured vs observed

| Item                           | Status                                                                                                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`     | Updated: `actions/checkout@v7`, `actions/setup-node@v7`, `upload-artifact@v7`; `npm ci --include=dev`; check/build; db/auth/submissions/reviews/**demo:check**; Playwright Chromium `--with-deps`; failure artifacts; `contents: read` |
| Observed green Actions run     | **Not observed** — no `git remote`                                                                                                                                                                                                     |
| Push / intended GitHub URL     | **Needed**                                                                                                                                                                                                                             |
| Assessment deadline + timezone | **Needed** before making the repo public                                                                                                                                                                                               |
| Authorized deployment target   | **Needed** for a hosted demo                                                                                                                                                                                                           |
| Part 2 video instructions      | **Needed** — [recording runbook](../videos/recording-runbook.md) only                                                                                                                                                                  |

## Operations summary

Documented in [operations.md](../operations.md): HTTPS ingress → Next → private Express → PostgreSQL; production `NODE_ENV` + Secure cookies; exact `WEB_ORIGINS`; proxy trust / `TRUST_INGRESS_CLIENT_IP`; runtime `API_INTERNAL_URL`; ingress limits; migration/seed order; backups/restore; destructive reset; graceful shutdown; monitoring/capacity; per-process rate limits; copied-token lifetime; demo isolation. No paid infrastructure created.
