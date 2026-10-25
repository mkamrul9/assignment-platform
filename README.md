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

Put a generated `JWT_SECRET` (32+ characters) and `MENTOR_*` credentials in `apps/api/.env`. If port 5432 is taken, set Compose `POSTGRES_PORT` and the host port in `DATABASE_URL` together.

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
npm ci --include=dev
npm run db:up
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). API default port is 4000.

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

Demo sandbox (optional, never the `reviewdock` database): copy `apps/api/.env.demo.example` and `apps/web/.env.demo.example`, then `npm run demo:prepare` and `npm run demo:dev`.

## Hosting (Vercel + API)

Vercel can host **Next.js** (`apps/web`). Express and PostgreSQL must run on a separate host (Render, Fly, Railway, a VM). The frontend is a proxy; it cannot replace the API.

Vercel project settings:

- Root Directory: `apps/web`
- Include files outside the root directory (npm workspaces)
- Env: `API_INTERNAL_URL` = private Express origin, `TRUST_INGRESS_CLIENT_IP=1` only behind a sanitizing ingress

Express production env: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `WEB_ORIGINS` = the exact HTTPS Vercel origin(s), `TRUST_PROXY=1`. Apply migrations (`npm run db:migrate:deploy`) and seed the mentor before traffic.

Cookies are Secure only when the API runs with `NODE_ENV=production`. Do not expose Express publicly.

## Layout

```text
apps/api/     Express, Prisma, integration checks
apps/web/     Next.js UI and `/api` proxy
e2e/          Playwright
compose.yaml  Local PostgreSQL
```
