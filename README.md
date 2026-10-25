# ReviewDock

Students submit projects. Mentors review them with notes, optional checkpoints, and a paginated queue.

```text
Browser → Next.js (`/api` proxy) → private Express API → PostgreSQL
```

## Setup

Node.js **24.11.1** (`.nvmrc`) or Node 22.18+; npm 10+. PostgreSQL 16 via Docker Compose.

PowerShell:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path apps/api/.env)) { Copy-Item apps/api/.env.example apps/api/.env }
if (!(Test-Path apps/web/.env.local)) { Copy-Item apps/web/.env.example apps/web/.env.local }
```

Bash:

```sh
test -e .env || cp .env.example .env
test -e apps/api/.env || cp apps/api/.env.example apps/api/.env
test -e apps/web/.env.local || cp apps/web/.env.example apps/web/.env.local
```

Copy the example env files above. JWT already has a demo default. Optional: put `MENTOR_*` credentials in `apps/api/.env` for `npm run db:seed`. If port 5432 is taken, set Compose `POSTGRES_PORT` and the host port in `DATABASE_URL` together.

```sh
npm ci --include=dev
npm run db:up
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). API default port is 4000.

## Demo accounts (one-click sign-in)

These are **shared public** sandbox users. They appear on **Sign in** and **Sign up** when `DEMO_MODE=1`. Click **Sign in as Student A** (or Mentor): the form fills and you enter the workspace. You do not need your own email.

| Role      | Email                             | Password         |
| --------- | --------------------------------- | ---------------- |
| Student A | `student-a@demo.reviewdock.local` | `DemoStudentA1!` |
| Student B | `student-b@demo.reviewdock.local` | `DemoStudentB1!` |
| Mentor    | `mentor@demo.reviewdock.local`    | `DemoMentor1!`   |

Local demo on the same ports as `npm run dev` (uses Compose Postgres, separate database):

```powershell
Copy-Item apps/api/.env.demo.example apps/api/.env.demo
# Set DATABASE_URL host port to your Compose POSTGRES_PORT (this machine: 5434).
# Point apps/api/.env at reviewdock_demo and set DEMO_MODE=1, then:
npm run demo:prepare
npm run dev
```

Anyone using a demo student shares that account’s projects. Mentor decisions are real inside the sandbox.

## Commands

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

`npm run demo:dev` is an alternate pair of ports (3001/4001) if you want demo isolated from `npm run dev`.

## Share a live link (no env vars to type)

The hosted demo already has secrets and `DEMO_MODE=1` in the code / `render.yaml`. You only connect GitHub. Render injects `DATABASE_URL` from Postgres.

1. Push this repo to GitHub (this project already has `origin`).
2. Open **[Deploy to Render](https://render.com/deploy?repo=https://github.com/mkamrul9/assignment-platform)** (or in the [Render dashboard](https://dashboard.render.com/): **New → Blueprint**, pick this repo).
3. Sign in with GitHub and click **Apply**. Do not fill environment variables.
4. Wait until the `reviewdock` web service is Live. The URL looks like `https://reviewdock-xxxx.onrender.com` — that is the link to share.

The first visit after idle time can take about a minute (free instances sleep). Use the on-page **Sign in as Student A** / **Mentor** buttons.

Free Render Postgres expires after 30 days. Upgrade that database if you need the demo to stay up.

## Layout

```text
apps/api/     Express, Prisma, integration checks
apps/web/     Next.js UI and `/api` proxy
e2e/          Playwright
compose.yaml  Local PostgreSQL
render.yaml   One-click Render Blueprint (web + Postgres)
Dockerfile    Hosted demo image (Next.js + Express together)
```
