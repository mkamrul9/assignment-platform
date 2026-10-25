# Implementation roadmap

Work proceeds in small, verifiable phases. Each commit should describe work that is actually complete. If a phase needs multiple commits, split it at a useful boundary, such as an API followed by its connected screen. Fixes belong in their own commits when they address a separate issue.

## 1. Foundation

- [x] Set up npm workspaces for `apps/web` and `apps/api`.
- [x] Configure strict TypeScript, ESLint, Prettier, and environment examples.
- [x] Add Next.js, Tailwind CSS, and a shadcn/ui starting point.
- [x] Add an Express health endpoint and shared error responses.
- [x] Forward frontend `/api` requests to Express.
- [x] Record the folder structure, decisions, and remaining work.
- [x] Verify checks, production builds, and HTTP smoke checks.

Completion: a clean install can run and build both apps, and the health endpoint works directly and through Next.js.

Commit: `chore: set up ReviewDock web and API workspaces`

## 2. Persistence

- [x] Add PostgreSQL development setup with Docker Compose.
- [x] Configure stable Prisma, migrations, and a shared API database client.
- [x] Model users, submissions, and review decisions with database constraints.
- [x] Add indexes for the review queue and status filtering.
- [x] Seed a mentor using credentials supplied through the environment.
- [x] Document database creation, migration, seed, and reset commands.

Completion: a fresh database can migrate and seed; constraints reject duplicate emails and canonical repository URLs. Re-running the seed is safe.

Commit: `feat: add project and reviewer persistence`

## 3. Authentication

- [x] Implement student signup, login, current-user lookup, and logout.
- [x] Hash passwords and validate all authentication input on the server.
- [x] Issue expiring JWTs in HttpOnly cookies, with production Secure settings.
- [x] Enforce student and mentor permissions in Express middleware.
- [x] Protect cookie-authenticated mutations against cross-origin requests.
- [x] Rate-limit signup and login; return useful, non-sensitive errors.
- [x] Build connected, accessible login and signup pages with role-aware navigation.

Completion: a new student can sign up and return after login; the seeded mentor can log in; missing, expired, tampered, and wrong-role tokens cannot access protected endpoints. A signup request cannot grant itself mentor privileges.

Commit: `feat: add student authentication and mentor access`

## 4. Student submissions

- [x] Add the authenticated submission endpoint and the student's own project list.
- [x] Validate project name, repository URL, live link, and description.
- [x] Normalize repository URLs and handle unique-constraint conflicts as HTTP 409.
- [x] Apply a submission rate limit with a clear retry response.
- [x] Build the submission form, field errors, loading states, and confirmation.
- [x] Show each student's submitted projects, status, and any review feedback.

Completion: a student can submit a valid project and see it after reload. Invalid links fail validation. Equivalent repository URLs and concurrent duplicate requests create at most one submission. Students cannot read another student's projects.

Commit: `feat: add project submissions with validation and duplicate protection`

## 5. Mentor reviews

- [x] Add mentor-only listing with validated page, page size, and status parameters.
- [x] Apply pagination and status filtering in PostgreSQL through Prisma.
- [x] Return aggregated pending, approved, rejected, and total counts.
- [x] Add approval and rejection endpoints, including reviewer and timestamp.
- [x] Require a short reason for rejection and guard against competing decisions.
- [x] Build the paginated shadcn/ui data table, filters, totals, and review dialog.
- [x] Refresh the queue and statistics after a successful decision.

Completion: filtering changes server results and pagination metadata. Counts reflect the full queue. Two mentors reviewing the same pending project cannot silently overwrite one another. Students cannot use review endpoints.

Commit: `feat: add the mentor review queue and decisions`

## 6. Verification and delivery

- [x] Complete integration tests for authorization, duplicate races, limits, filters, and review conflicts.
- [x] Add browser coverage for signup, submission, mentor login, and a review decision.
- [x] Check keyboard navigation, mobile layouts, empty states, and failures.
- [x] Add CI for checks, builds, and database-backed tests.
- [x] Document deployment settings, migrations, cookie security, and proxy configuration.
- [x] Verify the complete flow against a fresh PostgreSQL database.
- [x] Add final screenshots, API examples, and known tradeoffs to the README.
- [ ] Push to the intended GitHub repository and verify access.
- [ ] Make the repository public after the assessment deadline and verify signed-out access.

Local verification is complete. GitHub push, observed CI on GitHub Actions, and post-deadline public visibility remain open until a remote URL, push authorization, and deadline are supplied.

Possible commits: `test: cover the submission and review lifecycle`, `ci: verify the web and API workspaces`, `docs: document setup and delivery`

## Improvements (post Phase 6)

- [x] Fix API proxy Origin handling and client-IP trust at the Next.js boundary.
- [x] Add optional structured mentor feedback checkpoints with a forward migration.
- [x] Add recoverable student submission drafts scoped by student ID.
- [x] Add mentor search (`q`) with URL-backed queue controls.
- [x] Refresh product copy and screenshots from the working app.
- [x] Extend integration and Playwright coverage for the new behavior.
- [x] Update README, architecture, and decisions to match verified behavior.
- [x] Separate mentor request state, URL helpers, and dialog presentation; share API contracts and seed helpers.
- [x] Enforce strict TypeScript/lint checks for integration tests, seed/configuration, and browser tooling.
- [x] Cover logout failures, open-workspace expiry, proxy gateway failures, and reliable test cleanup.
- [x] Document contribution standards, shell-specific API examples, and production release prerequisites.
- [ ] Push to the intended GitHub repository, observe Actions, and verify access.
- [ ] Make the repository public after the assessment deadline.

## 7. Video lessons

- [ ] Read the detailed Part 2 instructions before choosing lesson topics or duration.
- [ ] Prepare two short lesson outlines using the finished implementation.
- [ ] Record, review, and deliver the required videos.

The supplied brief mentions two videos but does not include the lesson requirements. A technical recording runbook lives under `docs/videos/`. Lesson topics and durations stay undecided until Part 2 instructions arrive.

## Requested product upgrades (planned)

Copy-ready execution prompts and shared constraints live in [the upgrade guide](upgrades/README.md). Preserve the completed history above. Mark phases complete only with observed evidence.

### U1: Requirement audit and baseline

- [x] Map Part 1 stack/feature requirements to implementation and test evidence ([baseline](upgrades/baseline.md)).
- [x] Keep GitHub reachability, observed Actions CI, deployment host verification, and Part 2 videos as separate open items.
- [x] Audit auth, ownership, duplicates, limits, cookies, Origin, filters, reviews, and session/error recovery against live assertions.
- [x] Fix login bcrypt 72-byte truncation gap; harden `hashPassword` / `verifyPassword`; add auth regressions (including current DB role).
- [x] Fix mentor queue out-of-range page recovery so URL and Prev/Next stay aligned.
- [x] Record performance risks without claiming unmeasured wins; defer browse/detail to U4/U5 and optimization to U6.
- [x] Verify sequentially: `check`, `build`, `db:check`, `auth:check`, `submissions:check`, `reviews:check`, `test:e2e` (all passed locally).

Commits: `fix: reject over-long passwords on login`; `fix: sync mentor queue URL after page recovery`

### U2: Visual system and application shell

- [x] Replace green/Georgia–Segoe treatment with ink-blue actions, off-white/light-slate surfaces, amber accents, and semantic status colors with text labels.
- [x] Self-host Manrope via `next/font/local` (OFL notice under `apps/web/src/app/fonts/`); no runtime Google Fonts dependency.
- [x] Shared `AppShell` navbar/footer across home, auth, and workspace; role-aware links; mobile Menu while keeping workspace return visible.
- [x] Refine homepage, login/signup, and student/mentor workspace presentation without changing API contracts or adding demo accounts.
- [x] Verify: `npm run check`, `npm run build`, `npm run test:e2e` (13 Chromium tests). Synthetic screenshots refreshed via lifecycle e2e.
- [x] Manual visual inspection of contrast/overflow not separately recorded; Chromium automation covered desktop and 390px mobile paths.

Commit: `feat: apply ink-blue shell and Manrope typography`

### U3: Isolated opt-in demo sandbox

- [x] Opt-in `DEMO_MODE` with allowlisted `reviewdock_demo*` database guards; separate `.env.demo` / demo ports; development data preserved.
- [x] Idempotent synthetic seed: two students, one mentor, ≥25 submissions with reviews; collision failures; passwords hashed; no password overwrite on re-seed.
- [x] Auth-screen demo panel via `GET /api/demo/accounts` (404 when disabled); signup selection routes to login; no credentials in URLs/storage.
- [x] Normal Express auth, cookies, Origin, RBAC, and rate limits retained; documented shared-account and ingress limitations.
- [x] Verify: `check`, `build`, `db:check`, `auth:check`, `submissions:check`, `reviews:check`, `demo:check`, `test:e2e` (17 Chromium tests including demo panel).

Commit: `feat: add isolated opt-in demo sandbox`

### U4: Bounded student browsing and project details

- [x] Extend `GET /api/submissions/mine` with validated `page`/`pageSize`/`status`/`q`, owner-scoped PostgreSQL filtering/pagination, and independent owner `stats`.
- [x] Add `GET /api/submissions/:id` with student ownership / mentor workflow visibility, 404 non-disclosure for students, and `no-store` safe fields.
- [x] Connect `/student` search, status controls, server pagination, URL state, and `/student/projects/[id]` factual timeline/details.
- [x] Preserve drafts, duplicates, rate limits, demo isolation, and mentor review workflows.
- [x] Verify: `check`, `build`, `auth:check`, `submissions:check`, `reviews:check`, `test:e2e` (19 Chromium tests; schema unchanged so `db:check` not required for U4).

Commit: `feat: add bounded student project browsing and details`

### U5: Mentor workspace usability and review recovery

- [x] Keep compact server-paginated queue rows; load full description/review via U4 `GET /api/submissions/:id` when opening a project.
- [x] Add manual refresh and clear-filters controls; preserve URL-backed search/status/page/pageSize and global stats independence.
- [x] Harden the review dialog for detail loading/retry, stale-response protection, 409 conflict recovery from the detail API, and save-success vs refresh-failure messaging.
- [x] Preserve keyboard focus containment/restoration (with a useful fallback when the trigger row leaves the queue).
- [x] Verify: `check`, `build`, `auth:check`, `submissions:check`, `reviews:check`, `test:e2e` (20 Chromium tests including mentor workspace recovery).

Commit: `feat: refine mentor review details and conflict recovery`

### Remaining upgrade phases

- [ ] U6: Measure performance and run complete correctness/accessibility regression verification.
- [ ] U7: Finish final documentation and authorized, evidenced delivery.

## Working agreement

- Finish and verify the current phase before starting the next one.
- Keep the roadmap accurate as decisions change.
- Use real commit dates and clear messages; avoid bulk commits covering unrelated features.
- Keep secrets, generated output, and local database data out of Git.
- Set this repository's author to Kamrul using the existing Git email. GitHub account attribution also requires that email to belong to the intended account.
