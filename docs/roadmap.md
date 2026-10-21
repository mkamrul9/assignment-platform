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

- [ ] Add PostgreSQL development setup with Docker Compose.
- [ ] Configure stable Prisma, migrations, and a shared API database client.
- [ ] Model users, submissions, and review decisions with database constraints.
- [ ] Add indexes for the review queue and status filtering.
- [ ] Seed a mentor using credentials supplied through the environment.
- [ ] Document database creation, migration, seed, and reset commands.

Completion: a fresh database can migrate and seed; constraints reject duplicate emails and canonical repository URLs. Re-running the seed is safe.

Commit: `feat: add project and reviewer persistence`

## 3. Authentication

- [ ] Implement student signup, login, current-user lookup, and logout.
- [ ] Hash passwords and validate all authentication input on the server.
- [ ] Issue expiring JWTs in HttpOnly cookies, with production Secure settings.
- [ ] Enforce student and mentor permissions in Express middleware.
- [ ] Protect cookie-authenticated mutations against cross-origin requests.
- [ ] Rate-limit signup and login; return useful, non-sensitive errors.
- [ ] Build connected, accessible login and signup pages with role-aware navigation.

Completion: a new student can sign up and return after login; the seeded mentor can log in; missing, expired, tampered, and wrong-role tokens cannot access protected endpoints. A signup request cannot grant itself mentor privileges.

Commit: `feat: add student authentication and mentor access`

## 4. Student submissions

- [ ] Add the authenticated submission endpoint and the student's own project list.
- [ ] Validate project name, repository URL, live link, and description.
- [ ] Normalize repository URLs and handle unique-constraint conflicts as HTTP 409.
- [ ] Apply a submission rate limit with a clear retry response.
- [ ] Build the submission form, field errors, loading states, and confirmation.
- [ ] Show each student's submitted projects, status, and any review feedback.

Completion: a student can submit a valid project and see it after reload. Invalid links fail validation. Equivalent repository URLs and concurrent duplicate requests create at most one submission. Students cannot read another student's projects.

Commit: `feat: add project submissions with validation and duplicate protection`

## 5. Mentor reviews

- [ ] Add mentor-only listing with validated page, page size, and status parameters.
- [ ] Apply pagination and status filtering in PostgreSQL through Prisma.
- [ ] Return aggregated pending, approved, rejected, and total counts.
- [ ] Add approval and rejection endpoints, including reviewer and timestamp.
- [ ] Require a short reason for rejection and guard against competing decisions.
- [ ] Build the paginated shadcn/ui data table, filters, totals, and review dialog.
- [ ] Refresh the queue and statistics after a successful decision.

Completion: filtering changes server results and pagination metadata. Counts reflect the full queue. Two mentors reviewing the same pending project cannot silently overwrite one another. Students cannot use review endpoints.

Commit: `feat: add the mentor review queue and decisions`

## 6. Verification and delivery

- [ ] Complete integration tests for authorization, duplicate races, limits, filters, and review conflicts.
- [ ] Add browser coverage for signup, submission, mentor login, and a review decision.
- [ ] Check keyboard navigation, mobile layouts, empty states, and failures.
- [ ] Add CI for checks, builds, and database-backed tests.
- [ ] Document deployment settings, migrations, cookie security, and proxy configuration.
- [ ] Verify the complete flow against a fresh PostgreSQL database.
- [ ] Add final screenshots, API examples, and known tradeoffs to the README.
- [ ] Push to the intended GitHub repository and verify access.
- [ ] Make the repository public after the assessment deadline and verify signed-out access.

Completion: another developer can follow the README from a fresh clone, and the deployed or locally demonstrated flow works end to end.

Possible commits: `test: cover the submission and review lifecycle`, `ci: verify the web and API workspaces`, `docs: document setup and delivery`

## 7. Video lessons

- [ ] Read the detailed Part 2 instructions before choosing lesson topics or duration.
- [ ] Prepare two short lesson outlines using the finished implementation.
- [ ] Record, review, and deliver the required videos.

The supplied brief mentions two videos but does not include the lesson requirements. Keep this phase open until those instructions are available.

## Working agreement

- Finish and verify the current phase before starting the next one.
- Keep the roadmap accurate as decisions change.
- Use real commit dates and clear messages; avoid bulk commits covering unrelated features.
- Keep secrets, generated output, and local database data out of Git.
- Set this repository's author to Kamrul using the existing Git email. GitHub account attribution also requires that email to belong to the intended account.
