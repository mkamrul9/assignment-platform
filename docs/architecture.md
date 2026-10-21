# Architecture

## Boundaries

Next.js owns presentation, navigation, and form interaction. Express owns validation, authentication, authorization, business rules, and database access. PostgreSQL is accessed only from the API through Prisma.

The browser calls `/api/*` on the web origin. Next.js forwards those requests to Express using its server-only `API_INTERNAL_URL`. This keeps cookies on one browser origin and avoids requiring a public API hostname during development.

The only application endpoint implemented in phase 1 is `GET /api/health`. All other routes and data structures described below are planned.

## Planned structure

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
        layout/                   Shared workspace navigation
      features/
        auth/                     Auth forms and session access
        submissions/              Submission form and student project list
        reviews/                  Review table, filters, and decision dialog
      lib/
        api.ts                    Shared browser request and error handling
        utils.ts
  api/
    prisma/
      schema.prisma
      migrations/
      seed.ts
    src/
      config/env.ts
      lib/prisma.ts
      middleware/
        authenticate.ts
        require-role.ts
        rate-limits.ts
        error-handler.ts
      modules/
        health/
        auth/
        submissions/
        reviews/
      app.ts
      server.ts
    tests/                        API integration tests
docs/
compose.yaml                      Local PostgreSQL, added in phase 2
```

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

The foundation needs formatting, lint, type checks, production builds, and HTTP smoke checks. Feature phases will add tests around behavior that can fail in meaningful ways: permission boundaries, expired JWTs, database uniqueness under concurrency, pagination, rate limits, and atomic review transitions.

Integration tests should use an isolated PostgreSQL database. Tests that replace Prisma with mocks cannot prove database constraints or transactions work. Browser tests will cover the connected student and mentor journeys once those screens exist.

The foundation uses ESLint 9 because the React, import, and accessibility plugins bundled by Next.js 16.4.2 declare support through that major version. npm currently emits a deprecation notice for ESLint 9. Move to ESLint 10 when those plugins support it; do not bypass their peer requirements.

Reference documentation used for the foundation: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Tailwind with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [shadcn/ui setup](https://ui.shadcn.com/docs/installation/next), and [Express setup](https://expressjs.com/en/starter/hello-world/).
