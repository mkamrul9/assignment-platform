# ReviewDock

A project submission and review workspace for students and mentors.

Students will submit a repository, live link, and project description. Mentors will work through a review queue, leave a decision, and see submission totals at a glance.

## Current progress

Phase 3: student authentication and mentor access. Students can sign up and sign in; the seeded mentor can sign in; sessions use HttpOnly JWT cookies through the Next.js `/api` proxy. Submissions and reviews are planned next.

- [Roadmap and completion criteria](docs/roadmap.md)
- [Architecture and planned structure](docs/architecture.md)
- [Product decisions](docs/decisions.md)

## Stack

- TypeScript throughout
- Next.js App Router, Tailwind CSS, and shadcn/ui
- Express.js as the application API
- PostgreSQL and Prisma ORM
- JWT cookie sessions (`jose`) with student and mentor roles

The repository uses npm workspaces. The homepage and `GET /api/health` do not require PostgreSQL. Authentication and later features do.

The Next.js scripts explicitly use Webpack. Turbopack's CSS worker failed during setup on this Windows machine; the supported Webpack build passes with the same application code.

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

```sh
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

On Windows PowerShell:

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

`API_INTERNAL_URL` belongs to the Next.js server. Browser requests use relative `/api` URLs so cookies stay on the web origin. Prisma CLI commands, the API, and the seed script load `apps/api/.env` from that package directory.

### Commands

```sh
npm run dev              # Run both apps; Ctrl+C stops them
npm run dev:web          # Run only Next.js
npm run dev:api          # Run only Express
npm run check            # Formatting, linting, and TypeScript checks
npm run build            # Production builds for both workspaces
npm run format           # Format tracked source and documentation

npm run db:up            # Start local PostgreSQL (Docker Compose)
npm run db:down          # Stop PostgreSQL without deleting the volume
npm run db:generate      # Generate the Prisma client
npm run db:migrate       # Create/apply development migrations
npm run db:migrate:deploy # Apply committed migrations
npm run db:seed          # Seed the mentor account from apps/api/.env
npm run db:reset         # Destructive: drop data, re-apply migrations (does not auto-seed)
npm run db:check         # Isolated disposable-DB persistence checks
npm run auth:check       # Isolated disposable-DB authentication checks
```

`npm run db:down` stops the container and keeps the named Docker volume. `npm run db:reset` is destructive for the database named in `DATABASE_URL`. After a reset, run `npm run db:seed` again if you need the mentor account.

### Authentication

- `POST /api/auth/signup` — create a student, set session cookie
- `POST /api/auth/login` — student or mentor, set session cookie
- `GET /api/auth/me` — current user (`Cache-Control: no-store`)
- `POST /api/auth/logout` — clear session cookie

Sessions are 30-minute JWTs in the `reviewdock_session` HttpOnly cookie (`SameSite=Lax`, `Path=/`, `Secure` in production). Logout clears the browser cookie; a copied token remains valid until expiry. Passwords are at least 8 characters and at most 72 UTF-8 bytes (bcrypt’s input limit) and are never trimmed.

Signup and login are rate-limited in memory (5 signups/hour/IP, 10 logins/15 minutes/IP). That limiter is per API process. `TRUST_PROXY=1` trusts one proxy hop for client IP when requests arrive through Next.js; with `TRUST_PROXY=0`, spoofed `X-Forwarded-For` headers are ignored.

Frontend routes: `/signup`, `/login`, `/student`, `/mentor`.

### API health

Both addresses should return the same response while the two services are running. Neither requires PostgreSQL:

- [Direct API health](http://localhost:4000/api/health)
- [Health through the web server](http://localhost:3000/api/health)

```json
{ "status": "ok", "service": "reviewdock-api" }
```

### Mentor seed

Set `MENTOR_NAME`, `MENTOR_EMAIL`, and `MENTOR_PASSWORD` in `apps/api/.env`, then run `npm run db:seed`. The email is normalized before storage. The password is hashed with bcrypt. Re-running the seed leaves an existing mentor unchanged and does not reset the password. If the email already belongs to a student, the seed fails instead of granting mentor access.

## Repository layout

```text
apps/
  web/                  Next.js frontend and shadcn/ui components
    src/app/            Routes, root layout, and styles
    src/components/     UI primitives and shared layout
    src/features/auth/  Session provider, forms, and guards
    src/lib/            Frontend utilities
  api/                  Express application
    prisma/             Schema, migrations, and mentor seed
    src/config/         Validated environment settings
    src/lib/            Prisma client, JWT, cookies, passwords
    src/middleware/     Auth, origin, rate limits, errors
    src/modules/        Feature modules (health, auth, …)
    src/app.ts          Application wiring
    src/server.ts       Process startup and shutdown
    tests/              Database integration checks
compose.yaml            Local PostgreSQL
docs/                   Roadmap, architecture, and product decisions
```

## Submission handoff

The assessment requires a reachable GitHub repository that becomes public after the submission deadline. No remote repository or deployment is configured yet. Before final handoff, verify repository visibility and access from a signed-out browser, finish the run instructions, and complete both video lessons once their requirements are available.
