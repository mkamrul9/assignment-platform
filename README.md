# ReviewDock

A project submission and review workspace for students and mentors.

Students will submit a repository, live link, and project description. Mentors will work through a review queue, leave a decision, and see submission totals at a glance.

## Current progress

Phase 1: the development foundation. The web app has a small introductory page; the API has a health endpoint and JSON error responses. Authentication, persistence, submissions, and reviews are planned in separate phases.

- [Roadmap and completion criteria](docs/roadmap.md)
- [Architecture and planned structure](docs/architecture.md)
- [Product decisions](docs/decisions.md)

## Stack

- TypeScript throughout
- Next.js App Router, Tailwind CSS, and shadcn/ui
- Express.js as the application API
- PostgreSQL and Prisma ORM, added in phase 2
- JWT authentication with student and mentor roles, added in phase 3

The repository uses npm workspaces. The frontend and API can run independently; neither needs a database during phase 1.

The Next.js scripts explicitly use Webpack. Turbopack's CSS worker failed during setup on this Windows machine; the supported Webpack build passes with the same application code.

## Local development

Use Node.js 24.11.1 (see `.nvmrc`) and npm 10 or newer. Node.js 22.18 or newer in the 22.x line is also supported.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The Express API runs on port 4000.

Configuration is optional for the foundation. To change the defaults, copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`. Environment files are ignored by Git.

On Windows PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

`API_INTERNAL_URL` belongs to the Next.js server, and should point to the Express origin. Browser requests use relative `/api` URLs. Restart the web server after changing its environment; production rewrites are set when building the web app.

### Commands

```sh
npm run dev          # Run both apps; Ctrl+C stops them
npm run dev:web      # Run only Next.js
npm run dev:api      # Run only Express
npm run check        # Formatting, linting, and TypeScript checks
npm run build        # Production builds for both workspaces
npm run format       # Format tracked source and documentation
```

After building, start each service in its own terminal:

```sh
npm run start --workspace=@reviewdock/api
npm run start --workspace=@reviewdock/web
```

### API health

Both addresses should return the same response while the two services are running:

- [Direct API health](http://localhost:4000/api/health)
- [Health through the web server](http://localhost:3000/api/health)

```json
{ "status": "ok", "service": "reviewdock-api" }
```

This is a liveness check for Express. It does not check a database connection.

## Repository layout

```text
apps/
  web/                  Next.js frontend and shadcn/ui components
    src/app/            Routes, root layout, and styles
    src/components/ui/  Reusable UI primitives
    src/lib/            Frontend utilities
  api/                  Express application
    src/config/         Validated environment settings
    src/middleware/     Shared HTTP middleware
    src/modules/        Feature modules, starting with health
    src/app.ts          Application wiring
    src/server.ts       Process startup and shutdown
docs/                   Roadmap, architecture, and product decisions
```

## Submission handoff

The assessment requires a reachable GitHub repository that becomes public after the submission deadline. No remote repository or deployment is configured yet. Before final handoff, verify repository visibility and access from a signed-out browser, finish the run instructions, and complete both video lessons once their requirements are available.
