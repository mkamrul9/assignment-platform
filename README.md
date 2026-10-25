# ReviewDock

A project submission and review dashboard. Students submit a repository, live URL, and description. Mentors review a paginated queue, filter by status, and approve or reject with notes.

The browser talks only to Next.js. Next.js proxies `/api` to a private Express service. PostgreSQL is the source of truth.

```text
Browser → Next.js → Express → PostgreSQL
```

## Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript |
| Web | Next.js, Tailwind CSS, shadcn/ui |
| API | Express |
| Data | PostgreSQL, Prisma |
| Auth | JWT in an HTTP-only cookie, role-based access (`STUDENT`, `MENTOR`) |

## Features

**Students**
- Submit project name, repository URL, live URL, and description
- Client and server validation (HTTPS URLs, length limits, no credentials in URLs)
- Duplicate repositories are rejected (`409`) after URL canonicalization
- Submission rate limit: 5 attempts per 10 minutes per student

**Mentors**
- Paginated review table (page size 10 / 20 / 50)
- Approve or reject; rejection requires a note
- Status filters (`Pending`, `Approved`, `Rejected`, `All`) applied in the API, not the client
- Global totals: pending, approved, rejected, all

**Auth**
- Login for both roles
- Student signup only
- Mentor accounts are seeded (`npm run db:seed`), not self-registered

## Run locally

Requires Node.js 22.18+ (or 24.11 from `.nvmrc`), npm 10+, Docker.

```sh
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

npm ci --include=dev
npm run db:up
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

App: [http://localhost:3000](http://localhost:3000) · API: `http://127.0.0.1:4000`

If port 5432 is already in use, set `POSTGRES_PORT` in `.env` and the same host port in `apps/api/.env` `DATABASE_URL`.

## Accounts

After seed, sign in as the mentor from `apps/api/.env`:

| Role | Email | Password |
| --- | --- | --- |
| Mentor | `mentor@example.com` | `change-me-now` |

Create a student from **Sign up**.

When `DEMO_MODE=1` (hosted demo, or a local `reviewdock_demo` database), these shared sandbox users appear on Sign in:

| Role | Email | Password |
| --- | --- | --- |
| Student A | `student-a@demo.reviewdock.local` | `DemoStudentA1!` |
| Student B | `student-b@demo.reviewdock.local` | `DemoStudentB1!` |
| Mentor | `mentor@demo.reviewdock.local` | `DemoMentor1!` |

## Deploy

One Render service runs Next.js and Express; Postgres is provisioned by the Blueprint. Environment variables are already in `render.yaml`.

[Deploy to Render](https://render.com/deploy?repo=https://github.com/mkamrul9/assignment-platform)

The live URL is `https://reviewdock-xxxx.onrender.com`. Free instances sleep when idle; the first request can take about a minute. Free Render Postgres expires after 30 days.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Web + API |
| `npm run check` | Format, lint, types |
| `npm run test:e2e` | Playwright against a production build |
| `npm run db:seed` | Seed the mentor account |
