# ReviewDock

A project submission and review workspace for students and mentors.

Students sign up, draft and submit projects, and see review feedback. Mentors search and paginate the queue, see global totals, and approve or reject pending projects with notes and optional functionality/usability/documentation checkpoints. The UI uses ink-blue actions, neutral surfaces, and self-hosted Manrope across a shared navbar and footer.

## Assessment requirements vs optional enhancements

**Part 1 requirements (implemented):** TypeScript workspaces; Next.js + Tailwind + shadcn/ui; Express; PostgreSQL via Prisma; JWT role-based auth; student submission form with validation, duplicate protection, and rate limits; mentor paginated queue with server-side approved/rejected filters, aggregated totals, and approve/reject actions; student signup and seeded mentor login.

**Useful optional enhancements (not required by the brief):** recoverable student drafts; mentor search (`q`); structured review checkpoints; bounded student browse/search/details with factual timeline; mentor on-demand detail and conflict recovery; opt-in isolated public demo sandbox (`DEMO_MODE`); measured queue index for mentor ALL/newest pages; performance harness (`perf:check`).

Evidence: [U1 baseline](docs/upgrades/baseline.md), [U6 verification](docs/upgrades/verification.md).

Local integration and Chromium checks pass. **GitHub remote push, observed Actions CI, public visibility after the assessment deadline, hosted deployment, and Part 2 videos remain open** until those inputs are supplied. Localhost success is not public availability. See [operations](docs/operations.md) and [roadmap](docs/roadmap.md).

- [Architecture](docs/architecture.md) · [Decisions](docs/decisions.md) · [API examples](docs/api.md) · [Contributing](CONTRIBUTING.md) · [Operations](docs/operations.md)

## Stack and topology

TypeScript, npm workspaces, Next.js App Router, Tailwind CSS, shadcn/ui, Express, PostgreSQL, Prisma, bcryptjs, jose, Playwright.

```text
Browser → Next.js (/api proxy) → private Express API → PostgreSQL
```

Browsers use relative `/api` URLs. Next forwards Origin and cookies, returns multiple Set-Cookie values, never invents Origin, and strips caller forwarding headers by default. Express owns validation, authentication, authorization, transactions, and database access. `API_INTERNAL_URL` is server-only and read at runtime. Webpack remains enabled (Turbopack CSS worker failed on the original Windows setup).

## Setup (normal application)

Use Node.js **24.11.1** (`.nvmrc`) or Node **22.18+** in the 22.x line; npm 10+. PostgreSQL 16 via Docker Compose is the local database option. Run commands from the repository root. Configure environment files **before** migrations, seed, or startup. Preserve existing files, ports, and volumes.

### 1. Environment files

Bash:

```sh
test -e .env || cp .env.example .env
test -e apps/api/.env || cp apps/api/.env.example apps/api/.env
test -e apps/web/.env.local || cp apps/web/.env.example apps/web/.env.local
```

PowerShell:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path apps/api/.env)) { Copy-Item apps/api/.env.example apps/api/.env }
if (!(Test-Path apps/web/.env.local)) { Copy-Item apps/web/.env.example apps/web/.env.local }
```

Generate `JWT_SECRET` (either shell), then place the output in `apps/api/.env`:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

Set `MENTOR_NAME`, `MENTOR_EMAIL`, and `MENTOR_PASSWORD` in `apps/api/.env` before seeding. Do not commit real environment files.

| File                  | Purpose                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Root `.env`           | Compose `POSTGRES_PORT` (default 5432), user, password, `POSTGRES_DB` (`reviewdock`)                                                   |
| `apps/api/.env`       | `DATABASE_URL`, `PORT` (4000), `JWT_SECRET` (≥32 chars), issuer/audience, `WEB_ORIGINS`, `TRUST_PROXY`, seed `MENTOR_*`, `DEMO_MODE=0` |
| `apps/web/.env.local` | `API_INTERNAL_URL` (`http://127.0.0.1:4000`); optional `TRUST_INGRESS_CLIENT_IP` (off by default)                                      |

`WEB_ORIGINS` defaults to `http://localhost:3000,http://127.0.0.1:3000`. If host port 5432 is occupied, change Compose `POSTGRES_PORT` and the host port in `DATABASE_URL` together. Existing installations should keep their configured port (this machine has used **5434**).

API/Prisma/seed load `apps/api/.env` regardless of cwd; existing process env wins. Use development mode for local HTTP authentication.

### 2. Install, migrate, seed, start

Bash and PowerShell:

```sh
npm ci --include=dev
npm run db:up
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

`--include=dev` installs compilation/test dependencies even if `NODE_ENV=production` was set earlier. Open [localhost:3000](http://localhost:3000). Express defaults to 4000. Ctrl+C stops both apps.

Homepage and `GET /api/health` work without PostgreSQL; account and project features need it. Repeated mentor seeding leaves an existing mentor unchanged. A seed email owned by a student is rejected.

## Optional demo sandbox

Demo mode is **off by default** and never uses the development database name `reviewdock`.

Bash:

```sh
cp apps/api/.env.demo.example apps/api/.env.demo
cp apps/web/.env.demo.example apps/web/.env.demo.local
# Align host ports with Compose POSTGRES_PORT if needed.
npm run demo:prepare
npm run demo:dev
```

PowerShell:

```powershell
Copy-Item apps/api/.env.demo.example apps/api/.env.demo
Copy-Item apps/web/.env.demo.example apps/web/.env.demo.local
# Align host ports with Compose POSTGRES_PORT if needed.
npm run demo:prepare
npm run demo:dev
```

Open the demo web origin (default [localhost:3001](http://localhost:3001)). Login/signup show synthetic accounts from `GET /api/demo/accounts`. Auth still uses Express login, JWT cookies, Origin checks, and rate limits. Shared demo students share projects and submission rate buckets; mentor decisions are final inside the sandbox. `demo:reset` drops only an allowlisted `reviewdock_demo*` database. Local demo setup does not publish the app on the internet.

When `DEMO_MODE=0`, the demo panel is hidden and `/api/demo/accounts` is absent (404).

## Commands

```sh
npm run dev / dev:web / dev:api
npm run format / check / build
npm run db:up / db:down / db:generate / db:migrate / db:migrate:deploy / db:seed
npm run db:reset                 # DESTRUCTIVE on DATABASE_URL; does not seed
npm run db:check / auth:check / submissions:check / reviews:check
npm run demo:check / perf:check
npm run demo:prepare / demo:seed / demo:reset / demo:dev
npm run test:e2e / test:e2e:ui
```

Run `check`, `build`, and suites **sequentially** on one checkout (concurrent Prisma generate can race). Before the first browser run: `npx playwright install chromium` (Linux CI: `--with-deps`).

Database suites need a PostgreSQL user that can create/drop databases. E2E builds apps, starts them on ports 3010/4010, uses disposable `reviewdock_e2e*`, and cleans up processes/DB after success or setup failure. It never kills unrelated port owners. Override with `E2E_WEB_PORT` / `E2E_API_PORT` / `E2E_DATABASE_NAME`. Reports and runtime state are gitignored.

## Verification

Sequential local suite (also expected by CI):

```sh
npm run check
npm run build
npm run db:check
npm run auth:check
npm run submissions:check
npm run reviews:check
npm run demo:check
npm run test:e2e
```

Measured performance evidence (optional harness): `npm run perf:check` → [verification.md](docs/upgrades/verification.md).

Smoke:

```sh
curl -s http://localhost:4000/api/health
curl -s http://localhost:3000/api/health
```

Both return `{ "status": "ok", "service": "reviewdock-api" }` when the process/proxy is up. Health stays available if PostgreSQL is unreachable.

## API and screenshots

[API guide](docs/api.md): contracts plus Bash and PowerShell student→mentor→student sequences.

Screenshots from the real app (synthetic e2e data; refreshed by Playwright):

- [Public homepage](docs/screenshots/public-home.png)
- [Student signup](docs/screenshots/auth-signup.png)
- [Demo account selection](docs/screenshots/demo-account-selection.png)
- [Student empty state](docs/screenshots/student-empty.png)
- [Student mobile (390px)](docs/screenshots/student-mobile.png)
- [Submission confirmation](docs/screenshots/student-submit-success.png)
- [Student projects](docs/screenshots/student-projects.png)
- [Student project details](docs/screenshots/student-project-detail.png)
- [Mentor queue](docs/screenshots/mentor-queue.png)
- [Review dialog](docs/screenshots/mentor-review-dialog.png)

## Production and limitations

Read [operations](docs/operations.md) before release. Run **both** apps with `NODE_ENV=production`, keep Express private, serve the public web origin over HTTPS. Configure exact `WEB_ORIGINS`, migrations, seed order, backups, supervision, and monitoring for the chosen host. This repository does not provision paid infrastructure.

Notable limits: 30-minute JWT sessions (logout clears the cookie; copied tokens remain valid until expiry); in-memory per-process rate limits; drafts are browser-local; mentors cannot reopen decisions; health is liveness not DB readiness; contains-search is not a full-text service (see U6).

## CI and delivery status

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) is configured for push/PR: Node from `.nvmrc`, `npm ci --include=dev`, Prisma generate, `check`, production build, persistence/auth/submissions/reviews/`demo:check`, Playwright Chromium with deps, failure artifacts. Synthetic CI credentials only.

| Item                                                   | Status                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| Workflow file in repo                                  | Configured                                                    |
| Observed green GitHub Actions run                      | **Not observed** (no `git remote`)                            |
| Intended GitHub URL / push authorization               | **Needed**                                                    |
| Assessment deadline + timezone (for public visibility) | **Needed**                                                    |
| Authorized deployment target                           | **Needed** if a hosted demo is required                       |
| Part 2 video instructions                              | **Needed** ([runbook](docs/videos/recording-runbook.md) only) |

## Repository layout

```text
apps/api/                   Express, Prisma, integration/demo/perf checks
apps/web/                   Next.js routes, features, shared UI
e2e/                        Playwright specs and isolated harness
docs/                       Architecture, API, decisions, operations, screenshots, upgrades
docs/videos/                Technical recording runbook (lessons blocked on Part 2)
.github/workflows/ci.yml    Verification workflow
CONTRIBUTING.md             Coding standards
compose.yaml                Local PostgreSQL with persistent storage
```
