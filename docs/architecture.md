# Architecture

## Boundaries

Next.js owns presentation, navigation, and form interaction. Express owns validation, authentication, authorization, business rules, and database access. PostgreSQL is accessed only from the API through Prisma.

The browser calls `/api/*` on the web origin. Next.js forwards those requests to Express using its server-only `API_INTERNAL_URL`. This keeps cookies on one browser origin and avoids requiring a public API hostname during development.

The only application endpoint implemented so far is `GET /api/health`. Persistence models, migrations, and the mentor seed exist in phase 2. Authentication routes and feature screens remain planned.

## Structure

Add feature directories when their phase starts. Empty service or controller layers are unnecessary until there is work for them to do.

```text
apps/
  web/
    src/
      app/
        (auth)/                   Planned
          login/page.tsx
          signup/page.tsx
        (workspace)/              Planned
          student/page.tsx
          student/submit/page.tsx
          mentor/page.tsx
        globals.css
        layout.tsx
        page.tsx
      components/
        ui/                       shadcn/ui primitives
        layout/                   Planned shared workspace navigation
      features/                   Planned auth, submissions, reviews UI
      lib/
        utils.ts
  api/
    prisma/
      schema.prisma               Users, submissions, reviews
      migrations/
      seed.ts                     Mentor account from environment
    prisma.config.ts              Prisma CLI datasource and seed config
    src/
      config/env.ts
      lib/prisma.ts               Shared Prisma client (driver adapter)
      middleware/
        error-handler.ts
        authenticate.ts           Planned
        require-role.ts           Planned
        rate-limits.ts            Planned
      modules/
        health/
        auth/                     Planned
        submissions/              Planned
        reviews/                  Planned
      app.ts
      server.ts
    tests/
      persistence.check.ts        Isolated database constraint checks
compose.yaml                      Local PostgreSQL with persistent volume
docs/
```

PostgreSQL runs through Docker Compose. Prisma ORM 7 generates an ESM client into `apps/api/src/generated/prisma` (gitignored) and connects with `@prisma/adapter-pg`. Database access stays inside the Express workspace. Deleting a user cascades to their submissions; deleting a submission cascades to its review; deleting a mentor who still has reviews is restricted.

Each API feature will keep its routes, input schemas, and business logic together. Controllers and services can be separate files when their size justifies it. Start with direct Prisma calls inside feature services; a generic repository abstraction adds little value for this assessment.

## Data model outline

- **User:** ID, name, normalized unique email, password hash, role, creation time.
- **Submission:** ID, owner ID, project name, repository URL, unique canonical repository URL, live link, description, status, creation and update times.
- **Review:** ID, unique submission ID, mentor ID, decision, note, review time.

A submission starts pending. Approval or rejection writes the review and changes the status in one transaction. The implementation must make that transition conditional on the current status still being pending. Database uniqueness supplies the final protection against concurrent duplicate submissions and competing reviews.

## API outline

These are proposed routes, not completed functionality:

```text
GET    /api/health
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/submissions
GET    /api/submissions/mine
GET    /api/reviews/submissions?page=1&pageSize=10&status=PENDING
GET    /api/reviews/stats
POST   /api/reviews/submissions/:id/decision
```

The paginated response will contain rows and pagination metadata. Statistics cover the whole review queue, independent of the selected filter. Filter changes reset the UI to page 1, and list ordering uses creation time plus ID to make ties deterministic.

## Verification strategy

The foundation needs formatting, lint, type checks, production builds, and HTTP smoke checks. Phase 2 adds `npm run db:check`, which creates a disposable PostgreSQL database, applies committed migrations, and asserts uniqueness, foreign keys, default status, and safe mentor seeding against the real database. Feature phases will add tests around behavior that can fail in meaningful ways: permission boundaries, expired JWTs, database uniqueness under concurrency, pagination, rate limits, and atomic review transitions.

Integration tests should use an isolated PostgreSQL database. Tests that replace Prisma with mocks cannot prove database constraints or transactions work. Browser tests will cover the connected student and mentor journeys once those screens exist.

The foundation uses ESLint 9 because the React, import, and accessibility plugins bundled by Next.js 16.4.2 declare support through that major version. npm currently emits a deprecation notice for ESLint 9. Move to ESLint 10 when those plugins support it; do not bypass their peer requirements.

Reference documentation: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Tailwind with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [shadcn/ui setup](https://ui.shadcn.com/docs/installation/next), [Express setup](https://expressjs.com/en/starter/hello-world/), and [Prisma PostgreSQL quickstart](https://www.prisma.io/docs/orm/overview/databases/postgresql).
