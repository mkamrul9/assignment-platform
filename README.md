# ReviewDock

A project submission and review workspace for students and mentors.

Students sign up, draft and submit projects, and see review feedback. Mentors search and paginate the queue, see global totals, and approve or reject pending projects with notes and optional functionality/usability/documentation checkpoints. The UI uses ink-blue actions, neutral surfaces, and self-hosted Manrope across a shared navbar and footer.

The application is implemented and covered by local integration and Chromium browser checks. GitHub delivery and observed Actions CI remain pending. Deployment verification is separate from local test results; see [operations and release readiness](docs/operations.md).

- [Architecture and folder responsibilities](docs/architecture.md)
- [Product decisions and limitations](docs/decisions.md)
- [Roadmap and delivery status](docs/roadmap.md)
- [Contribution and code standards](CONTRIBUTING.md)
- [API guide: Bash and PowerShell examples](docs/api.md)

## Stack and topology

TypeScript, npm workspaces, Next.js App Router, Tailwind CSS, shadcn/ui conventions, Express, PostgreSQL, Prisma ORM, bcryptjs, jose, and Playwright.

```text
Browser -> Next.js (/api proxy) -> private Express API -> PostgreSQL
```

Browsers use relative `/api` URLs. Next forwards the incoming Origin, cookies, and multiple Set-Cookie values. It never invents an Origin and strips caller-controlled forwarding headers by default. Express owns validation, authentication, authorization, transactions, and database access.

`API_INTERNAL_URL` is server-only and read at runtime. Keep signing and database secrets out of the frontend environment. Webpack remains enabled because Turbopack's CSS worker failed on the original Windows setup.

## Setup

Use Node.js **24.11.1** (`.nvmrc`) and npm 10 or newer. Node.js 22.18 or newer in the 22.x line is also supported. PostgreSQL 16 via Docker Compose is the local database option.

Run commands from the repository root. Configure environment files **before** running migrations, seed, or startup. Preserve existing files and configured database ports.

### 1. Create missing environment files

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

Generate a signing secret using this command in either shell, then put its output in `apps/api/.env` as `JWT_SECRET`:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

Set `MENTOR_NAME`, `MENTOR_EMAIL`, and `MENTOR_PASSWORD` in that same file before seeding. Example credentials are development placeholders; choose your own. Do not commit real environment files.

Configuration locations:

- Root `.env`: Compose `POSTGRES_PORT` (5432), `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` (development defaults: `reviewdock`).
- `apps/api/.env`: `DATABASE_URL`, `PORT` (4000), `JWT_SECRET` (required, at least 32 characters), `JWT_ISSUER` (`reviewdock`), `JWT_AUDIENCE` (`reviewdock-web`), `WEB_ORIGINS`, `TRUST_PROXY`, and seed-only `MENTOR_*` variables.
- `apps/web/.env.local`: `API_INTERNAL_URL` (`http://127.0.0.1:4000`) and optional `TRUST_INGRESS_CLIENT_IP` (off by default).

`WEB_ORIGINS` defaults to `http://localhost:3000,http://127.0.0.1:3000`. The API defaults to not trusting proxies; its example file sets `TRUST_PROXY=1` for the single Next.js hop. If 5432 is occupied, change both Compose `POSTGRES_PORT` and the host port in `DATABASE_URL`. Existing installations should retain their configured port.

API, seed, and Prisma commands load `apps/api/.env` regardless of the invoking directory. Existing process environment variables take precedence. Next loads its own web environment. Use development mode for local HTTP authentication.

### 2. Install, migrate, seed, and start

These commands work in Bash and PowerShell:

```sh
npm ci --include=dev
npm run db:up
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

`--include=dev` ensures compilation/test dependencies are installed even if the shell previously set `NODE_ENV=production`. Open [localhost:3000](http://localhost:3000). Express defaults to port 4000. Ctrl+C stops both development apps.

The homepage and `GET /api/health` work without PostgreSQL; account and project features require it. Repeated mentor seeding leaves an existing mentor and password unchanged. A seed email owned by a student is rejected.

## Commands and verification

```sh
npm run dev                  # Both apps
npm run dev:web              # Next.js only
npm run dev:api              # Express only
npm run format               # Format project files
npm run check                # Formatting, lint, strict TypeScript, including test tooling
npm run build                # Production builds for both workspaces

npm run db:up                # Start PostgreSQL
npm run db:down              # Stop PostgreSQL, keep its volume
npm run db:generate          # Generate Prisma client (also done on install/build/check)
npm run db:migrate           # Create/apply development migrations
npm run db:migrate:deploy    # Apply committed migrations
npm run db:seed              # Seed mentor from API environment
npm run db:reset             # DESTRUCTIVE: reset the configured database; does not seed

npm run db:check             # Disposable PostgreSQL persistence checks
npm run auth:check           # Auth, cookies, roles, Origin, limits
npm run submissions:check    # Validation, ownership, duplicate races, limits
npm run reviews:check        # Queue/search, stats, decisions, races, rollback
npm run demo:check           # Demo guards, seed idempotence, metadata, logins
npm run test:e2e             # Build, then run Chromium browser checks
npm run test:e2e:ui          # Build, then open the Playwright UI

npm run demo:prepare         # Create allowlisted demo DB, migrate, seed fixtures
npm run demo:seed            # Idempotent demo fixture seed (requires DEMO_MODE=1)
npm run demo:reset           # DESTRUCTIVE: rebuild only the demo sandbox database
npm run demo:dev             # Run API+web using apps/api/.env.demo (ports 4001/3001)
```

### Optional isolated demo sandbox

Demo mode is **off by default**. It never uses the development database name `reviewdock`. Copy the demo env examples, point `DATABASE_URL` at `reviewdock_demo` (same Postgres server is fine; keep your existing port), then:

```sh
cp apps/api/.env.demo.example apps/api/.env.demo
cp apps/web/.env.demo.example apps/web/.env.demo.local
# Edit host ports in those files to match your Compose POSTGRES_PORT if needed.
npm run demo:prepare
npm run demo:dev
```

Open the demo web origin (default [localhost:3001](http://localhost:3001)). Login and signup show shared synthetic accounts from `GET /api/demo/accounts`. Authentication still uses normal Express login, JWT cookies, Origin checks, and rate limits. Visitors sharing a demo student share that account’s projects and submission rate bucket; mentor decisions are final inside the sandbox. Local demo setup does not publish the app on the internet. `demo:reset` drops only an allowlisted `reviewdock_demo*` database.

When `DEMO_MODE=0`, the demo panel is hidden and `/api/demo/accounts` is not mounted (404).

Run `check`, `build`, and the test suites sequentially against the same checkout; simultaneous Prisma generation can race. `check` includes integration checks, Prisma seed/configuration, and Playwright tooling through `tsconfig.tooling.json` and the tooling lint command.

Before the first browser run:

```sh
npx playwright install chromium
```

On Linux CI, use `npx playwright install chromium --with-deps`.

Database tests require a PostgreSQL test user allowed to create/drop databases. They use disposable databases; browser tests seed synthetic accounts and more than one page of projects. E2E starts built Next.js and Express processes on ports 3010/4010, waits for readiness, and cleans up its own processes/database after completion or setup failure. Local E2E runs the API in test mode for HTTP cookies; production cookie security is unchanged.

Use `E2E_WEB_PORT` / `E2E_API_PORT` for alternate test ports. Occupied ports cause a clear error; the suite never kills their owner. `E2E_DATABASE_NAME` must be `reviewdock_e2e` or start with `reviewdock_e2e_` and must differ from the development database. Reports, traces, credentials, and runtime state are gitignored.

Browser coverage includes lifecycle, drafts, feedback checkpoints, filters/search/pagination, keyboard dialogs, mobile layouts, session expiry, and intercepted error/retry scenarios. Direct helper regressions cover proxy failure contracts and database reset safeguards. See the test output for the checks actually run; passing automated checks does not replace screen-reader, cross-browser, or load testing.

## API and screenshots

[The API guide](docs/api.md) documents requests, responses, permissions, pagination, and a complete student-to-mentor-to-student sequence in both shells.

```sh
curl -s http://localhost:4000/api/health
curl -s http://localhost:3000/api/health
```

Both return `{ "status": "ok", "service": "reviewdock-api" }` when the corresponding process/proxy is available.

Screenshots captured from the working application with synthetic accounts:

- [Student empty state](docs/screenshots/student-empty.png)
- [Submission confirmation](docs/screenshots/student-submit-success.png)
- [Student projects list](docs/screenshots/student-projects.png)
- [Student project details](docs/screenshots/student-project-detail.png)
- [Mentor queue](docs/screenshots/mentor-queue.png)
- [Review dialog](docs/screenshots/mentor-review-dialog.png)

## Production operation and limitations

Read [operations](docs/operations.md) before release. Run **both apps** with `NODE_ENV=production`, keep Express private, and serve the public web origin over HTTPS. Express then uses Secure, HttpOnly, host-only, SameSite=Lax session cookies. Configure exact trusted Origins, migrations, seed ordering, backups, process supervision, and monitoring for the chosen host.

The proxy maps upstream connection errors to JSON 502 and upstream timeouts to JSON 504. API shutdown drains active requests and disconnects Prisma within a bounded deadline.

Known scope and deployment limits:

- JWT sessions last 30 minutes. Logout clears the browser cookie; copied tokens remain valid until expiry. Passwords are never trimmed and must fit bcrypt's 72-byte UTF-8 limit.
- Rate limits are in-memory per API process and reset on restart: signup 5/hour/IP, login 10/15 minutes/IP, submissions 5/10 minutes/student. Multiple API instances need a shared limiter store.
- Without a sanitizing ingress, login/signup share the Next-to-Express peer IP. Enable `TRUST_INGRESS_CLIENT_IP=1` only behind an ingress that replaces forwarding headers with a verified client address and cannot be bypassed.
- Drafts live in versioned, student-scoped local browser storage. They are not server backups.
- Mentors cannot edit or reopen decisions; students cannot resubmit an already-used canonical repository URL. There is no account-recovery flow.
- Health is process liveness, not a database readiness check. Backups and capacity/load testing are deployment responsibilities.

## CI and delivery

[The workflow](.github/workflows/ci.yml) is configured for pushes and pull requests: Node from `.nvmrc`, `npm ci --include=dev`, checks, production builds, PostgreSQL integration tests, and Chromium E2E. Failure reports/traces are uploaded. It uses synthetic credentials, not private production secrets.

A configured workflow is not an observed passing GitHub run. No remote is currently configured. Remaining delivery inputs are the intended repository URL/push authorization, the assessment deadline and timezone for public visibility, and detailed Part 2 video requirements. Corresponding roadmap items remain open.

## Repository layout

```text
apps/api/                  Express, Prisma, integration checks
apps/web/                  Next.js routes, feature modules, shared UI
e2e/                       Playwright specs and isolated test harness
docs/                      Architecture, API, decisions, operations, screenshots
.github/workflows/ci.yml    Verification workflow
CONTRIBUTING.md            Coding and contribution standards
tsconfig.tooling.json      Strict checks for tests, seed, and tooling
compose.yaml               Local PostgreSQL with persistent storage
```
