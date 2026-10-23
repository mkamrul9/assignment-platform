# Architecture

## Boundaries

Next.js owns presentation, navigation, and form interaction. Express owns validation, authentication, authorization, business rules, and database access. PostgreSQL is accessed only from the API through Prisma.

The browser calls `/api/*` on the web origin. Next.js forwards those requests to Express using its server-only `API_INTERNAL_URL`. This keeps cookies on one browser origin and avoids requiring a public API hostname during development.

Implemented so far: health, persistence, authentication, and student submissions (`POST /api/submissions`, `GET /api/submissions/mine`). Mentor review features remain planned.

## Structure

Add feature directories when their phase starts. Empty service or controller layers are unnecessary until there is work for them to do.

```text
apps/
  web/
    src/
      app/
        (auth)/
          login/page.tsx
          signup/page.tsx
        (workspace)/
          student/page.tsx
          student/submit/page.tsx
          mentor/page.tsx
        globals.css
        layout.tsx
        page.tsx
      components/
        ui/                       shadcn/ui primitives
        layout/                   Shared header / navigation
      features/
        auth/                     Session provider, forms, guards
        submissions/              Submit form and project list
      lib/
        api.ts                    Relative /api fetch helper
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
      lib/canonical-repository-url.ts
      middleware/
        error-handler.ts
        authenticate.ts
        require-role.ts
        require-trusted-origin.ts
        rate-limits.ts
      modules/
        health/
        auth/
        submissions/
        reviews/                  Planned
      app.ts
      server.ts
    tests/
      persistence.check.ts
      auth.check.ts
      submissions.check.ts
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

Health, auth, and student submissions are implemented. Mentor review routes remain proposed:

```text
GET    /api/health
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/submissions
GET    /api/submissions/mine
GET    /api/reviews/submissions?...          Planned
GET    /api/reviews/stats                    Planned
POST   /api/reviews/submissions/:id/decision Planned
```

The paginated response will contain rows and pagination metadata. Statistics cover the whole review queue, independent of the selected filter. Filter changes reset the UI to page 1, and list ordering uses creation time plus ID to make ties deterministic.

## Verification strategy

The foundation needs formatting, lint, type checks, production builds, and HTTP smoke checks. Phase 2 adds `npm run db:check`. Phase 3 adds `npm run auth:check`. Phase 4 adds `npm run submissions:check` for validation, canonicalization, uniqueness races, ownership isolation, origin protection, and per-student rate limits, plus a browser journey through `/student/submit`.

Integration tests should use an isolated PostgreSQL database. Tests that replace Prisma with mocks cannot prove database constraints or transactions work. Browser tests will cover the connected student and mentor journeys once those screens exist.

The foundation uses ESLint 9 because the React, import, and accessibility plugins bundled by Next.js 16.4.2 declare support through that major version. npm currently emits a deprecation notice for ESLint 9. Move to ESLint 10 when those plugins support it; do not bypass their peer requirements.

Reference documentation: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Tailwind with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [shadcn/ui setup](https://ui.shadcn.com/docs/installation/next), [Express setup](https://expressjs.com/en/starter/hello-world/), and [Prisma PostgreSQL quickstart](https://www.prisma.io/docs/orm/overview/databases/postgresql).
