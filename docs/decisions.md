# Product decisions

The brief leaves some behavior open. These are the starting rules; changing one should also update the implementation and its tests.

## Accounts and roles

Public signup creates a `STUDENT` account. The seeded admin mentioned in the brief is the reviewer account with the `MENTOR` role. There is no separate superadmin role or public mentor signup in this scope.

Emails are trimmed and normalized before storage. Passwords are hashed. The API checks permissions on every protected request; frontend navigation is only a convenience. Students can read their own submissions. Mentors can read the full queue and decide pending submissions.

## Submission rules

All four project fields are required. Planned limits are 3–100 characters for the name, 20–5,000 for the description, and 2,048 for each URL. Text is trimmed; whitespace-only values fail validation. Links must be valid HTTPS URLs without embedded credentials. Render descriptions as plain text.

A student may submit multiple distinct projects. A repository may appear only once across the workspace, even after rejection. Team submissions, edits, deletion, and resubmission are outside the initial scope.

Canonical repository URLs ignore trailing slashes, a final `.git`, query parameters, and fragments. Hosts are normalized; GitHub owner and repository names are case-insensitive. Preserve path case for other hosts. The URL rules will have explicit examples and tests in the submission phase. A database unique constraint handles races; a disabled submit button alone cannot prevent duplicates.

The server validates links but does not fetch them. GitHub verification and ownership checks are outside this assessment's requested scope.

## Review rules

Statuses are `PENDING`, `APPROVED`, and `REJECTED`. A new submission is pending. Only pending submissions can receive a decision. Approvals can have an optional note; rejection requires a reason of 10–1,000 characters so the student receives usable feedback.

Store who reviewed the project and when. If another mentor has already decided, return a conflict and reload the current result. Review history, reopening decisions, and appeals are future work.

## Queue and statistics

The mentor list defaults to pending, newest first, with 10 rows per page. Offer all, pending, approved, and rejected filters. Validate page numbers and cap page size at 50. All filtering, counting, and pagination happens on the server.

Show pending, approved, rejected, and total counts across all submissions. Changing the table's filter does not change what those summary counts mean.

## Session and spam protection

Use a signed, expiring JWT in an HttpOnly, SameSite cookie, with Secure enabled in production. Validate the token's algorithm, issuer, audience, and expiry. Do not put tokens in browser local storage. Check request origin for cookie-authenticated mutations, and verify that cookie forwarding works through the Next.js proxy.

Start with a 30-minute session and login again on expiry. Logout clears the cookie; immediate revocation of copied tokens is outside the initial scope and will be documented.

Proposed limits are 10 login attempts per 15 minutes per IP, 5 signups per hour per IP, and 5 submission attempts per 10 minutes per student. Include HTTP 429 and retry information. In-memory limits suit a single API process; a multi-instance deployment needs a shared store. Configure trusted proxy handling explicitly for the chosen deployment.

## Presentation

ReviewDock uses warm neutral surfaces, dark green accents, and a compact, readable workspace. The useful distinction is visible review feedback and a clear account of each project's current state. Prioritize forms, queues, accessible controls, and honest empty states over decoration.

## Delivery

Keep the repository private initially if needed, then make it public after the submission deadline as the assessment requires. Do not invent a deadline: none was supplied. GitHub hosting, production deployment, and the two video lessons belong to later phases.
