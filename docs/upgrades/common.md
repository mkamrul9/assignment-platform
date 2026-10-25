# Contract for every upgrade phase

Read this entire file before implementing a U-phase. The prompt defines the phase's boundary; do not implement later phases early.

## Inspect first

Read the full supplied assessment in `docs/assessment-brief.md`, plus `README.md`, `CONTRIBUTING.md`, `docs/roadmap.md`, `docs/architecture.md`, `docs/decisions.md`, `docs/operations.md`, this upgrade directory, applicable `AGENTS.md` instructions, and the code/tests relevant to your phase. Inspect Git status, recent commits, remotes, configuration, and existing functionality. Preserve unrelated work.

## Preserve the working foundation

- Keep npm workspaces, strict TypeScript, ESLint, Prettier, the Node compatibility policy, committed lockfile, and Webpack. Avoid unnecessary dependency upgrades or a framework rewrite.
- Preserve existing data, volumes, credentials, JWT secret, environment files, and configured ports. This machine previously used PostgreSQL host port **5434**; inspect the current setting rather than assuming it.
- Keep database access in Express, use the shared Prisma client, and reuse authentication/current-role middleware, Origin protection, rate limits, explicit response selections, error helpers, and frontend relative `/api` requests.
- Keep liveness at `GET /api/health` database-independent. Preserve HttpOnly/SameSite cookies, production Secure cookies, token expiry, host-only scope, and server-side RBAC.
- Preserve canonical uniqueness, student ownership, rejection-note rules, and conditional transactional review writes. Client controls never provide correctness or authorization.
- Keep account-scoped drafts/caches, stable server snapshots, stale-response protection, honest logout/expiry behavior, and safe proxy failure handling.
- Preserve applied migrations. Add forward migrations only when needed. Never reset development or shared data to make a test pass.

## Design and feature boundaries

The approved direction is ink blue, neutral surfaces, restrained amber, and self-hosted Manrope. Semantic status colors must remain distinguishable without relying on color alone. Use shadcn/ui conventions with accessible labels, focus, contrast, keyboard navigation, and responsive layouts.

Prefer concise, useful copy and meaningful primary actions. Every added control must work. Do not add fake metrics, placeholder charts, fake notifications, unimplemented navigation, or long promotional sections. Do not introduce chat, payments, file uploads, AI grading, decision editing/reopening, appeals, bulk decisions, or a new admin role. Do not start the video lessons without their detailed instructions.

Keep components and services focused. Comments should explain invariants, boundaries, concurrency, and decisions. Avoid blanket suppressions, `any`, heavy dependencies without a reason, duplicated validation contracts, and speculative generic layers.

## Verification and evidence

Consult official documentation when adding a library, changing framework integration, or depending on an unfamiliar API. Preserve offline/self-hosted build behavior for fonts and assets.

Use isolated disposable PostgreSQL databases for database checks and synthetic accounts for browser tests. Do not mock PostgreSQL to claim constraints or transactions work. Cleanup must run on failures. Keep reports, authentication state, runtime files, and real secrets out of Git.

Run `npm run check`, `npm run build`, and the existing integration/browser suites affected by the phase. Do not generate Prisma concurrently against the same output directory or build over an actively used Next.js development output. Use an isolated checkout/output if needed; do not terminate unrelated processes. Run the complete suite in U6/U7:

```sh
npm run check
npm run build
npm run db:check
npm run auth:check
npm run submissions:check
npm run reviews:check
npm run test:e2e
```

Add repeatable regression assertions for meaningful changes. Keep old assertion coverage; update tests to the documented new contract instead of weakening them. Browser checks must exercise the rendered interface through the real Next.js proxy, Express, and PostgreSQL. Report browser automation, API tests, manual visual inspection, and untested environments separately. Never claim CI, public access, deployment, or performance improvements without observing them.

## Finish each phase

Update relevant docs/examples and append an upgrade subsection to the roadmap without rewriting completed history. Mark only verified work complete. State files/behavior changed, exact commands/results, and remaining blockers. Review the diff for secrets/unrelated files and create a professional focused commit using the existing author configuration. Do not invent commit dates. If unrelated changes prevent safe staging, preserve them and report the exact issue. Stop after the requested phase.
