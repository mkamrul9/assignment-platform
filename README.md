# ReviewDock

A project submission and review workspace for students and mentors.

Students submit a repository, live link, and project description. Mentors work through a review queue, leave a decision, and see submission totals at a glance.

## Current progress

Phase 6: verification and delivery preparation. Integration checks, Playwright browser coverage (including keyboard, mobile, and failure recovery), CI workflow configuration, deployment documentation, and synthetic screenshots are in place. GitHub hosting and post-deadline public visibility still need an intended remote and deadline.

- [Roadmap and completion criteria](docs/roadmap.md)
- [Architecture](docs/architecture.md)
- [Product decisions](docs/decisions.md)
- [Screenshots](docs/screenshots/)

## Stack

- TypeScript throughout
- Next.js App Router, Tailwind CSS, and shadcn/ui
- Express.js as the application API
- PostgreSQL and Prisma ORM
- JWT cookie sessions (`jose`) with student and mentor roles
- Playwright end-to-end tests against a disposable database

The repository uses npm workspaces. The homepage and `GET /api/health` do not require PostgreSQL. Authentication, submissions, and reviews do.

The Next.js scripts explicitly use Webpack. Turbopack's CSS worker failed during setup on this Windows machine; the supported Webpack build passes with the same application code.

## Topology

```text
Browser  →  Next.js (public origin, /api proxy)  →  Express (private)  →  PostgreSQL
```

Browsers call relative `/api/*` on the web origin. Next.js forwards those requests through `apps/web/src/app/api/[...path]/route.ts`, preserving `Origin`, `Cookie`, and `Set-Cookie`. Express owns validation, authorization, and database access. `API_INTERNAL_URL` is read by the Next.js server at request time and must point at the private Express process.

## Local development

Use Node.js 24.11.1 (see `.nvmrc`) and npm 10 or newer. Node.js 22.18 or newer in the 22.x line is also supported.

```sh
npm ci
npm run db:up
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Open [localhost:3000](http://localhost:3000). The Express API runs on port 4000.

### Environment files

Copy the examples before changing defaults. Environment files are ignored by Git. If you already have a working `apps/api/.env`, keep its `DATABASE_URL` host port and add any new keys from `.env.example`.

Bash:

```sh
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Generate a session secret and put it in `apps/api/.env`:

```sh
openssl rand -base64 48
```

Defaults:

| Variable                                              | Default                                                                      | Where                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------- |
| `POSTGRES_PORT`                                       | `5432`                                                                       | root `.env` / `compose.yaml` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `reviewdock`                                                                 | root `.env` / `compose.yaml` |
| `DATABASE_URL`                                        | `postgresql://reviewdock:reviewdock@127.0.0.1:5432/reviewdock?schema=public` | `apps/api/.env`              |
| `PORT`                                                | `4000`                                                                       | `apps/api/.env`              |
| `API_INTERNAL_URL`                                    | `http://127.0.0.1:4000`                                                      | `apps/web/.env.local`        |
| `JWT_SECRET`                                          | _(required, generate locally)_                                               | `apps/api/.env`              |
| `JWT_ISSUER` / `JWT_AUDIENCE`                         | `reviewdock` / `reviewdock-web`                                              | `apps/api/.env`              |
| `WEB_ORIGINS`                                         | `http://localhost:3000,http://127.0.0.1:3000`                                | `apps/api/.env`              |
| `TRUST_PROXY`                                         | `1`                                                                          | `apps/api/.env`              |
| `MENTOR_*`                                            | example placeholders                                                         | `apps/api/.env` (seed only)  |

If host port `5432` is already in use, set `POSTGRES_PORT` in the root `.env` and the matching host port in `apps/api/.env` `DATABASE_URL`.

### Commands

```sh
npm run dev              # Run both apps; Ctrl+C stops them
npm run check            # Formatting, linting, and TypeScript checks
npm run build            # Production builds for both workspaces
npm run format           # Format tracked source and documentation

npm run db:up            # Start local PostgreSQL (Docker Compose)
npm run db:down          # Stop PostgreSQL without deleting the volume
npm run db:migrate:deploy # Apply committed migrations
npm run db:seed          # Seed the mentor account from apps/api/.env
npm run db:reset         # Destructive: drop data, re-apply migrations (does not auto-seed)

npm run db:check         # Isolated disposable-DB persistence checks
npm run auth:check       # Isolated disposable-DB authentication checks
npm run submissions:check # Isolated disposable-DB submission checks
npm run reviews:check    # Isolated disposable-DB mentor review checks
npm run test:e2e         # Build both apps, then run Playwright
npm run test:e2e:ui      # Same, with the Playwright UI
```

`npm run db:down` stops the container and keeps the named Docker volume. `npm run db:reset` is destructive for the database named in `DATABASE_URL`. After a reset, run `npm run db:seed` again if you need the mentor account. Integration and e2e suites create disposable databases and clean them up; they do not wipe the development database.

First Playwright run also needs browsers:

```sh
npx playwright install chromium
```

On Linux CI, use `npx playwright install chromium --with-deps`.

## Screenshots

Captured from the working app with synthetic e2e data:

| File                                                                                       | Scene                              |
| ------------------------------------------------------------------------------------------ | ---------------------------------- |
| [docs/screenshots/student-empty.png](docs/screenshots/student-empty.png)                   | New student empty project list     |
| [docs/screenshots/student-submit-success.png](docs/screenshots/student-submit-success.png) | Successful submission confirmation |
| [docs/screenshots/student-projects.png](docs/screenshots/student-projects.png)             | Student project list with status   |
| [docs/screenshots/mentor-queue.png](docs/screenshots/mentor-queue.png)                     | Mentor stats and review queue      |
| [docs/screenshots/mentor-review-dialog.png](docs/screenshots/mentor-review-dialog.png)     | Review dialog after a decision     |

## API examples

Health (PostgreSQL not required):

```sh
curl -s http://localhost:4000/api/health
curl -s http://localhost:3000/api/health
```

```json
{ "status": "ok", "service": "reviewdock-api" }
```

Student signup and session (browser Origin required for mutations):

```sh
curl -s -c cookies.txt -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \
  -d '{"name":"Ada Student","email":"ada@example.com","password":"student-pass-1"}' \
  http://localhost:3000/api/auth/signup

curl -s -b cookies.txt http://localhost:3000/api/auth/me
```

Submit a project:

```sh
curl -s -b cookies.txt -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \
  -d '{"projectName":"Demo Project","repositoryUrl":"https://github.com/example/demo","liveUrl":"https://demo.example.com","description":"A long enough description for the API example."}' \
  http://localhost:3000/api/submissions
```

Mentor review queue, stats, and decision (use a seeded mentor session cookie):

```sh
curl -s -b mentor.txt "http://localhost:3000/api/reviews/submissions?status=PENDING&page=1&pageSize=10"
curl -s -b mentor.txt http://localhost:3000/api/reviews/stats
curl -s -b mentor.txt -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \
  -d '{"decision":"REJECTED","note":"Please expand the README with setup steps."}' \
  http://localhost:3000/api/reviews/submissions/<id>/decision
```

Frontend routes: `/signup`, `/login`, `/student`, `/student/submit`, `/mentor`.

### Authentication notes

Sessions are 30-minute JWTs in the `reviewdock_session` HttpOnly cookie (`SameSite=Lax`, `Path=/`, `Secure` in production). Logout clears the browser cookie; a copied token remains valid until expiry. Passwords are at least 8 characters and at most 72 UTF-8 bytes and are never trimmed.

Rate limits are in-memory per API process: 5 signups/hour/IP, 10 logins/15 minutes/IP, 5 submissions/10 minutes/student. `TRUST_PROXY=1` trusts one reverse-proxy hop for client IP when traffic arrives through Next.js.

### Mentor seed

Set `MENTOR_NAME`, `MENTOR_EMAIL`, and `MENTOR_PASSWORD` in `apps/api/.env`, then run `npm run db:seed`. Re-running the seed leaves an existing mentor unchanged. If the email already belongs to a student, the seed fails instead of granting mentor access.

## Production build smoke

```sh
npm run build
npm run start --workspace=@reviewdock/api
npm run start --workspace=@reviewdock/web
```

Point `API_INTERNAL_URL` at the running Express process before starting Next.js. Confirm homepage, direct health, and proxied health. Health remains independent of PostgreSQL.

## Deployment notes

ReviewDock expects HTTPS in production so `Secure` session cookies work. Configure:

1. PostgreSQL with backups; apply committed migrations (`npm run db:migrate:deploy`) before serving traffic.
2. Seed the mentor once with deployment secrets (`MENTOR_*`), not on every release.
3. Express privately reachable from Next.js via `API_INTERNAL_URL`.
4. `WEB_ORIGINS` set to the public browser origin(s).
5. `TRUST_PROXY=1` when Next.js (or another single hop) forwards client IP.
6. A long random `JWT_SECRET` (≥ 32 characters).

Do not expose Express publicly if the Next.js `/api` proxy is the intended browser boundary. In-memory rate limits do not coordinate across multiple API processes. `npm run db:reset` destroys the configured database; prefer migrate deploy plus backups in production.

This repository does not create paid hosting. Choose your own host and follow the topology above.

## Known limitations

- Logout clears the browser cookie only; a copied JWT remains valid until expiry.
- Rate limits are per process and reset on restart.
- Mentors cannot reopen or edit decisions; students cannot resubmit the same canonical repository URL.
- GitHub repository publishing and video lessons are outside Phase 6.

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pushes and pull requests: `npm ci`, formatting/lint/typecheck, production builds, disposable-DB integration checks, Playwright Chromium install, and e2e tests. Failure reports/traces upload as artifacts. Private production credentials are not required; CI uses workflow-local secrets and a PostgreSQL service container.

A workflow file being present is not the same as a green run on GitHub. Observe the Actions tab after a remote is configured and a push succeeds.

## Repository layout

```text
apps/
  web/                  Next.js frontend, /api proxy route, shadcn/ui
  api/                  Express application, Prisma, integration checks
e2e/                    Playwright specs and disposable-DB harness
docs/                   Roadmap, architecture, decisions, screenshots
.github/workflows/      CI
compose.yaml            Local PostgreSQL
```

## Submission handoff

The assessment requires a reachable GitHub repository that becomes public after the submission deadline. No git remote is configured in this working copy yet. Missing inputs for the remaining delivery items:

- Intended GitHub account / repository URL
- Authorization to push
- Assessment deadline for making the repository public

Until those are supplied, keep the GitHub push and public-visibility roadmap items open. Video lessons remain Phase 7.
