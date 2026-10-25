# Architecture

## Boundaries

Next.js owns presentation, navigation, and form interaction. Express owns validation, authentication, authorization, business rules, and database access. PostgreSQL is accessed only from the API through Prisma.

The browser calls `/api/*` on the web origin. Next.js forwards those requests to Express through `apps/web/src/app/api/[...path]/route.ts` using server-only `API_INTERNAL_URL`. The proxy preserves an incoming `Origin` exactly when present (it never invents one), forwards `Cookie`, and returns multiple `Set-Cookie` values so Express trusted-origin checks and session cookies stay aligned with the public web origin. Caller-supplied `X-Forwarded-For` / `X-Real-IP` / `Forwarded` headers are stripped. Accurate per-IP login/signup limits require a trusted ingress that replaces (not appends) the client address and `TRUST_INGRESS_CLIENT_IP=1` on the web app; otherwise Express rates by the Next→Express peer (conservative shared bucket). Keep Express privately reachable.

Implemented so far: health, persistence, authentication, student submissions, mentor reviews, Playwright e2e coverage, and CI configuration.

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
        api/[...path]/route.ts    Proxy to Express with Origin/Cookie forwarding
        fonts/                    Self-hosted Manrope (OFL) + localFont loader
        globals.css               Design tokens (ink-blue / neutrals / amber)
        layout.tsx
        page.tsx
      components/
        ui/                       shadcn/ui primitives
        layout/                   AppShell, navbar, footer (shared chrome)
      features/
        auth/                     Session provider, forms, guards
        submissions/              Submit form and project list
        reviews/                  Queue composition, store, query helpers, and dialog
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
        reviews/                  Queue, stats, and atomic decisions
      app.ts
      server.ts
    tests/
      persistence.check.ts
      auth.check.ts
      submissions.check.ts
      reviews.check.ts
e2e/                              Playwright harness and specs
.github/workflows/ci.yml
compose.yaml                      Local PostgreSQL with persistent volume
docs/
  screenshots/                    Synthetic UI captures from e2e
```

PostgreSQL runs through Docker Compose. Prisma ORM 7 generates an ESM client into `apps/api/src/generated/prisma` (gitignored) and connects with `@prisma/adapter-pg`. Database access stays inside the Express workspace. Deleting a user cascades to their submissions; deleting a submission cascades to its review; deleting a mentor who still has reviews is restricted.

Each API feature will keep its routes, input schemas, and business logic together. Controllers and services can be separate files when their size justifies it. Start with direct Prisma calls inside feature services; a generic repository abstraction adds little value for this assessment.

## Data model outline

- **User:** ID, name, normalized unique email, password hash, role, creation time.
- **Submission:** ID, owner ID, project name, repository URL, unique canonical repository URL, live link, description, status, creation and update times.
- **Review:** ID, unique submission ID, mentor ID, decision, note, optional functionality/usability/documentation checkpoints (`MEETS_EXPECTATIONS` | `NEEDS_IMPROVEMENT` | `NOT_ASSESSED`), review time. Existing reviews without checkpoints read as `NOT_ASSESSED`.

A submission starts pending. Approval or rejection writes the review and changes the status in one transaction. The transition uses a conditional `updateMany` on `status = PENDING`, then creates the unique review row in the same transaction. Database uniqueness supplies the final protection against concurrent duplicate submissions and competing reviews.

## API outline

Health, auth, student submissions, and mentor reviews are implemented:

```text
GET    /api/health
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/submissions
GET    /api/submissions/mine
GET    /api/reviews/submissions?page&pageSize&status&q
GET    /api/reviews/stats
POST   /api/reviews/submissions/:id/decision
```

`GET /api/reviews/submissions` is mentor-only. Defaults are `page=1`, `pageSize=10`, `status=PENDING`. `status` accepts `ALL`, `PENDING`, `APPROVED`, or `REJECTED`. Optional `q` (trimmed, max 100 characters) searches project name, student name/email, and repository URL with case-insensitive Prisma matching. Ordering is `createdAt` descending, then `id` descending. Filtering, search, counting, and pagination run together in PostgreSQL. Out-of-range pages return an empty `submissions` array with stable pagination metadata for the requested page. Responses use explicit field selection and `Cache-Control: no-store`. The mentor UI keeps `q`, `status`, `page`, and `pageSize` in the URL.

`GET /api/reviews/stats` returns global `{ pending, approved, rejected, total }` counts independent of queue filters and search.

`POST /api/reviews/submissions/:id/decision` requires a trusted Origin. Body: `{ decision: "APPROVED" | "REJECTED", note?: string, checkpoints?: { functionality?, usability?, documentation? } }`. Checkpoint values are `MEETS_EXPECTATIONS`, `NEEDS_IMPROVEMENT`, or `NOT_ASSESSED`; omitted checkpoints default to `NOT_ASSESSED` so legacy clients that send only decision/note remain valid. Rejection notes are required (10–1,000 characters after trim). Approval notes are optional (max 1,000; blank becomes `null`). Checkpoints are stored in the same atomic transaction as the decision. Missing submissions return `404`; already-decided submissions return `409`. Reviewer identity and timestamp come from the server.

The paginated response contains rows and pagination metadata. Statistics cover the whole review queue, independent of the selected filter. Filter changes reset the UI to page 1, and list ordering uses creation time plus ID to make ties deterministic.

## Verification strategy

The foundation needs formatting, lint, type checks, production builds, and HTTP smoke checks. Phase 2 adds `npm run db:check`. Phase 3 adds `npm run auth:check`. Phase 4 adds `npm run submissions:check`. Phase 5 adds `npm run reviews:check`. Phase 6 adds Playwright (`npm run test:e2e`) against a disposable database with real Next.js + Express processes, plus `.github/workflows/ci.yml`.

Integration tests use isolated PostgreSQL databases and clean up after failures. Browser checks cover signup/login, submission validation, mentor filters/pagination/decisions, keyboard dialog focus, mobile viewports, intercepted failure/retry paths, and session-expiry navigation. Screenshots live under `docs/screenshots/`.

The foundation uses ESLint 9 because the React, import, and accessibility plugins bundled by Next.js 16.4.2 declare support through that major version. npm currently emits a deprecation notice for ESLint 9. Move to ESLint 10 when those plugins support it; do not bypass their peer requirements.

Reference documentation: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Tailwind with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [shadcn/ui setup](https://ui.shadcn.com/docs/installation/next), [Express setup](https://expressjs.com/en/starter/hello-world/), and [Prisma PostgreSQL quickstart](https://www.prisma.io/docs/orm/overview/databases/postgresql).

## Maintenance and lifecycle contracts

The mentor feature separates `mentor-queue.tsx` (composition), `mentor-queue-store.ts` (request sequencing/cache), `queue-query.ts` (URL contracts), `review-dialog.tsx` (dialog presentation), and `presentation.ts` (display formatting). Browser stores use stable server snapshots; account changes invalidate private caches and in-flight requests. Authenticated API 401 responses notify the session provider so guards can navigate to login. Logout is acknowledged only after the API clears the cookie.

API routes share field-error serialization in `lib/validation.ts`, explicit safe user selection in `lib/public-user.ts`, and the same password/email helpers as the mentor seed. Shutdown drains HTTP requests before disconnecting Prisma. The web proxy maps upstream connection/timeout failures to safe JSON gateway errors.

`tsconfig.tooling.json` adds strict checks for integration tests, Prisma seed/configuration, and Playwright. The normal root `check` command also lints those files. Contributor standards live in `CONTRIBUTING.md`; release requirements and remaining operational limits live in `docs/operations.md`.
