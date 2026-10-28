# ReviewDock

A full-stack project submission and review dashboard. Students submit projects and track feedback; mentors review a paginated queue, approve or reject submissions, and monitor overall progress.

Built with **TypeScript, Next.js, React, Tailwind CSS, shadcn/ui, Express, PostgreSQL, and Prisma**. Authentication uses signed JWTs in HTTP-only cookies with student and mentor permissions enforced by the API.

## Features

### Student workspace

- Submit a project name, repository URL, live URL, and description.
- Receive field-level validation and clear duplicate or rate-limit errors.
- Recover unfinished submission drafts after navigation or a page reload.
- Search, filter, and paginate personal submissions.
- View project status, mentor feedback, and review checkpoints.

### Mentor workspace

- Search and filter submissions on the server by pending, approved, rejected, or all statuses.
- Browse a paginated queue and open full project details.
- Approve projects or reject them with an actionable note.
- Assess functionality, usability, and documentation independently.
- View global totals that remain independent of the current table filter.

### Reliability and access control

- Public signup creates student accounts; mentor accounts are seeded separately.
- Students can access only their own submissions. Mentors can access the review queue.
- Canonical repository URLs and a database unique constraint prevent duplicate submissions, including concurrent requests.
- Transactional decisions prevent competing reviews from overwriting one another.
- Login, signup, and submission endpoints apply rate limits.
- Expired sessions, backend timeouts, and review conflicts receive explicit recovery paths.

## Architecture

```text
Browser -> Next.js /api proxy -> Express -> Prisma -> PostgreSQL
```

The browser uses relative `/api` URLs. Next.js forwards requests to the private API and preserves session cookies. Express owns authentication, authorization, validation, and business rules. PostgreSQL stores users, submissions, and reviews.

```text
apps/
  api/
    prisma/       Database schema, migrations, and seed entry points
    src/
      config/     Environment loading and validation
      demo/       Synthetic demo accounts and fixtures
      lib/        Database, session, password, and validation helpers
      middleware/ Authentication, permissions, rate limits, and errors
      modules/    Authentication, submissions, reviews, health, and demo routes
  web/
    src/
      app/        Next.js pages, layouts, styles, and API proxy
      components/ Shared layout and UI components
      features/   Authentication, submission, and review interfaces
      lib/        Request handling, proxy headers, and shared utilities
scripts/          Hosted startup
```

## Run locally

### Prerequisites

- Node.js **22.18 or later in the 22.x series**, or **24.11 or later in the 24.x series**.
- npm **10 or later**.
- Docker with Docker Compose for the local PostgreSQL service.

### 1. Clone and configure

```sh
git clone https://github.com/mkamrul9/assignment-platform.git
cd assignment-platform
```

Create the local configuration files from their templates:

- Copy `.env.example` to `.env` for Docker/PostgreSQL settings.
- Copy `apps/api/.env.example` to `apps/api/.env` for API settings.
- Copy `apps/web/.env.example` to `apps/web/.env.local` for the internal API URL.

Set `JWT_SECRET` to a random value of at least 32 characters and choose the mentor credentials in `apps/api/.env`. Keep `DEMO_MODE=0` for ordinary local use. Environment files are excluded from Git.

If port `5432` is occupied, change `POSTGRES_PORT` in the root `.env` and use the same port in the API's `DATABASE_URL`.

### 2. Install and initialize

```sh
npm ci --include=dev
npm run db:up
npm run db:migrate:deploy
npm run db:seed
```

Wait for PostgreSQL to become healthy before applying migrations. Installation generates the Prisma client automatically. Mentor seeding leaves an existing account unchanged.

### 3. Start the application

```sh
npm run dev
```

- Application: [http://localhost:3000](http://localhost:3000)
- API health: [http://127.0.0.1:4000/api/health](http://127.0.0.1:4000/api/health)

Create a student account through **Sign up**, or sign in with the mentor credentials configured before seeding. Stop the development servers with `Ctrl+C`. Use `npm run db:down` to stop PostgreSQL while preserving its data volume.

## Commands

- `npm run dev` — start the frontend and API together.
- `npm run dev:web` / `npm run dev:api` — start one workspace.
- `npm run typecheck` — check TypeScript across both workspaces.
- `npm run build` — generate the Prisma client and build both applications.
- `npm run db:generate` — regenerate the Prisma client after schema changes.
- `npm run db:migrate` — create and apply a migration during development.
- `npm run db:migrate:deploy` — apply committed migrations.
- `npm run db:seed` — create the configured mentor account.
- `npm run demo:seed` — seed synthetic fixtures into an existing demo database using a demo configuration.
- `npm run start:hosted` — migrate, seed, and start the hosted demo after a build.

## Application rules

- A student may submit multiple distinct projects. A repository can be submitted only once across the application, including after rejection.
- Repository identity ignores trailing slashes, a final `.git`, query parameters, and fragments. GitHub owner and repository names are case-insensitive.
- Project links must use HTTPS and must not contain embedded credentials. The application validates URLs without fetching or verifying the linked project.
- New submissions start as pending. Only pending submissions can receive a decision; completed reviews cannot be edited or reopened.
- Rejection requires a note of 10–1,000 characters. Approval notes and individual checkpoints are optional.
- Default limits are five submission attempts per student per ten minutes, ten login attempts per IP per fifteen minutes, and five signup attempts per IP per hour.

## Hosted demo

The included `Dockerfile` builds both applications. `render.yaml` provisions the demo service and PostgreSQL; the startup script applies migrations, seeds synthetic data, and starts both servers. Only the frontend port needs public access.

[Deploy the demo to Render](https://render.com/deploy?repo=https://github.com/mkamrul9/assignment-platform)

Demo accounts appear on the authentication screens when `DEMO_MODE=1`. These are shared synthetic accounts: submissions and review decisions are visible to other visitors. Use a dedicated demo database. Local demo seeding accepts database names matching `reviewdock_demo` or `reviewdock_demo_*`; the hosted path also accepts platform-provided remote database names.

The hosted launcher is configured for a public demo and enables demo mode. For a private deployment, use a separate startup configuration, a private `JWT_SECRET`, explicit `WEB_ORIGINS`, HTTPS, and an internal-only API. The Render configuration generates a signing secret; direct use of the launcher otherwise has a public demo fallback.

## Operational notes

- Rate limits are stored in memory and suit a single API process. Multiple instances need a shared limiter store.
- The proxy strips caller-supplied forwarding headers by default. Enable `TRUST_INGRESS_CLIENT_IP=1` only behind an ingress that replaces those headers with a verified client address; otherwise login/signup limits share the proxy's address.
- Sessions expire after 30 minutes. Logout clears the browser cookie; a previously copied token remains valid until expiry.
- Drafts are stored in the browser under the student's ID and can remain on a shared device until discarded or site data is cleared.
- Arbitrary substring searches can require database scans as the dataset grows.
- The health endpoint reports API liveness; it does not confirm database readiness.

## Third-party licenses

The adapted shadcn/ui component notice is preserved in `LICENSE.shadcn`. The bundled Manrope font license is preserved in `apps/web/src/app/fonts/OFL.txt`. Dependencies retain their respective licenses.
