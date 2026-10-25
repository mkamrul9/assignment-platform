# Contributing to ReviewDock

## Before changing code

Read `README.md`, `docs/architecture.md`, `docs/decisions.md`, and the current roadmap. Check `git status` first and preserve unrelated changes. Keep local environment files and database volumes intact. Work within the agreed feature scope.

## Project boundaries

- `apps/api/src/modules/<feature>` owns that feature's route, input schemas, and business logic. Routes handle HTTP; services handle database operations. Keep authorization in Express.
- `apps/api/src/middleware` owns reusable authentication, roles, Origin protection, and limits. `src/lib` holds focused shared helpers. Reuse the single Prisma client.
- `apps/web/src/app` owns route composition. `src/features` owns connected feature behavior and components. `src/components/ui` holds reusable UI primitives. Browsers use the relative `/api` helper.
- Keep request/cache state separate from presentation when either grows substantially. Clear private caches on account changes and ignore stale network responses.
- Prefer small explicit functions and domain names. Introduce abstractions when they remove real duplication or isolate a meaningful responsibility.

## Types, comments, and errors

Use strict TypeScript. Infer response types from explicit Prisma selections where practical. Do not use `any`, blanket lint suppressions, or non-null assertions to conceal an uncertain state.

Write comments for invariants, security boundaries, concurrency, and non-obvious tradeoffs. Public helpers should explain their contract when the name and type do not suffice. Avoid comments that merely repeat a statement; update comments with the behavior they describe.

Validate all untrusted input on the server. Use the shared field-error and API-error helpers. Never include passwords, tokens, hashes, or database connection strings in public errors or logs. Preserve useful failure feedback in forms. Report a saved mutation separately from a failed refresh.

Keep keyboard navigation, labels, error associations, loading states, mobile layout, and plain-text rendering intact. Client guards assist navigation; they never replace API permissions.

## Database changes

Create forward migrations with `npm run db:migrate --workspace=@reviewdock/api -- --name descriptive_name`. Commit the schema and generated SQL together. Never rewrite an applied migration or reset a shared database. Review uniqueness, foreign keys, deletion behavior, and indexes. Test races and transactions against PostgreSQL.

Seed credentials come from the environment. Repeated seeding must preserve existing credentials and must not promote students.

## Local verification

Run these sequentially from the repository root; `check` and `build` both generate Prisma files:

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

`check` covers application code, integration checks, Prisma configuration/seed, and Playwright tooling. Database suites need PostgreSQL and a local test user allowed to create/drop disposable databases. `demo:check` uses an allowlisted disposable demo database and also asserts disabled-demo behavior. E2E uses separate processes and synthetic accounts; see the README for ports and safety restrictions. Optional `perf:check` writes measured evidence under `docs/upgrades/` and must not target the development database.

Add regression coverage for meaningful defects and new behavior. Do not mock PostgreSQL to claim that database constraints work. Browser interception is appropriate for client failure states. Update API examples and docs whenever contracts or setup change.

## Commits and delivery

Use focused conventional commits such as `fix: preserve session after failed logout` or `docs: clarify production configuration`. Review the staged diff and keep generated output and secrets out of Git. Record which checks actually ran; keep unverified CI/deployment items open. Publishing, visibility changes, and deployment require the intended destination and authorization.
