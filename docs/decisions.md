# Product decisions

The brief leaves some behavior open. These are the starting rules; changing one should also update the implementation and its tests.

## Accounts and roles

Public signup creates a `STUDENT` account. The seeded admin mentioned in the brief is the reviewer account with the `MENTOR` role. There is no separate superadmin role or public mentor signup in this scope.

Emails are trimmed and normalized before storage. Passwords are hashed. The API checks permissions on every protected request; frontend navigation is only a convenience. Students can read their own submissions. Mentors can read the full queue and decide pending submissions.

## Submission rules

All four project fields are required. Planned limits are 3–100 characters for the name, 20–5,000 for the description, and 2,048 for each URL. Text is trimmed; whitespace-only values fail validation. Links must be valid HTTPS URLs without embedded credentials. Render descriptions as plain text.

A student may submit multiple distinct projects. A repository may appear only once across the workspace, even after rejection. Team submissions, edits, deletion, and resubmission are outside the initial scope.

Canonical repository URLs ignore trailing slashes, a final `.git`, query parameters, and fragments. Hosts are normalized; GitHub owner and repository names are case-insensitive. Preserve path case for other hosts. Explicit examples live in `apps/api/src/lib/canonical-repository-url.ts` and `npm run submissions:check`. A database unique constraint handles races; a disabled submit button alone cannot prevent duplicates.

The server validates links but does not fetch them. GitHub verification and ownership checks are outside this assessment's requested scope.

## Review rules

Statuses are `PENDING`, `APPROVED`, and `REJECTED`. A new submission is pending. Only pending submissions can receive a decision. Approvals can have an optional note; rejection requires a reason of 10–1,000 characters so the student receives usable feedback. Mentors may also set optional checkpoints for functionality, usability, and documentation (`Meets expectations`, `Needs improvement`, or `Not assessed`). The overall approve/reject choice remains the mentor's explicit decision; the note carries actionable guidance. Review editing, reopening, appeals, and automatic grading are out of scope.

Store who reviewed the project and when. If another mentor has already decided, return a conflict and reload the current result. Legacy reviews without checkpoint values display as not assessed.

## Queue and statistics

The mentor list defaults to pending, newest first, with 10 rows per page. Offer all, pending, approved, and rejected filters, plus optional search (`q`, max 100 characters after trim) over project name, student name/email, and repository URL. Validate page numbers and cap page size at 50. All filtering, search, counting, and pagination happens on the server. The mentor UI mirrors `q`, `status`, `page`, and `pageSize` in the URL for refresh, direct links, and Back/Forward.

Show pending, approved, rejected, and total counts across all submissions. Changing the table's filter or search does not change what those summary counts mean.

## Student submission drafts

The submission form autosaves `projectName`, `repositoryUrl`, `liveUrl`, and `description` to versioned browser `localStorage`, keyed by authenticated student ID. Drafts are debounced, restored after reload or navigation, and cleared only after a confirmed successful submit or an explicit Discard. Failed validation, duplicates, rate limits, and network errors keep the draft. Pending writes are cancelled when clearing so stale timers cannot recreate it. Logout and account changes clear in-memory form state and pending writes so one student never sees another's draft. Malformed, unavailable, or full storage must not break the form. Session tokens and passwords are never stored. Shared devices may retain another account's stored draft until overwritten or discarded; only the matching student ID can restore it. Server validation remains authoritative.

## Session and spam protection

Use a signed, expiring JWT (`jose`, HS256) in an HttpOnly, SameSite=Lax, host-only cookie with `Path=/`, and Secure enabled in production. Validate the algorithm, issuer, audience, subject, and expiry. Do not put tokens in JSON responses or browser local storage. Check the `Origin` header for signup, login, logout, and other cookie-authenticated mutations against `WEB_ORIGINS`. Do not derive trust from arbitrary `Host` or client-controlled forwarding headers.

Passwords are never trimmed. They must be at least 8 characters and at most 72 UTF-8 bytes so bcrypt cannot silently truncate them. Public signup always creates `STUDENT` accounts; clients cannot set `role`.

Start with a 30-minute session and sign in again on expiry. Logout clears the browser cookie; a copied token remains valid until it expires. Immediate server-side revocation is outside this phase.

Limits are 10 login attempts per 15 minutes per IP, 5 signups per hour per IP, and 5 submission attempts per 10 minutes per student. Include HTTP 429 and retry information. The in-memory limiter suits a single API process; multi-instance deployments need a shared store. `TRUST_PROXY=1` trusts one reverse-proxy hop for `req.ip` when traffic arrives through the Next.js `/api` proxy. The Next proxy strips caller forwarding headers by default, so login/signup buckets share the Next→Express peer address unless a trusted ingress replaces `X-Forwarded-For` with the verified client IP and the web app sets `TRUST_INGRESS_CLIENT_IP=1`.

## Presentation

ReviewDock uses warm neutral surfaces, dark green accents, and a compact, readable workspace. The useful distinction is visible review feedback and a clear account of each project's current state. Prioritize forms, queues, accessible controls, and honest empty states over decoration.

## Delivery

Keep the repository private initially if needed, then make it public after the submission deadline as the assessment requires. Do not invent a deadline: none was supplied. GitHub hosting, production deployment, and the two video lessons belong to later phases.
