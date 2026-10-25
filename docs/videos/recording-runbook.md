# Technical recording runbook

Part 2 lesson topics, durations, language, format, and submission method are **not yet available**. This runbook prepares the technical demonstration sequence only. Lesson packages (learning objectives, narration scripts, timed outlines) will be added under `docs/videos/` once the brief arrives.

Distinguish **prepared scripts** from **videos actually recorded, reviewed, and delivered**. Nothing in this folder is a finished recording.

## Startup (normal local app)

1. `npm ci --include=dev`
2. `npm run db:up`
3. `npm run db:migrate:deploy`
4. Confirm `apps/api/.env` has a strong `JWT_SECRET` and seed credentials.
5. `npm run db:seed` (uses `MENTOR_*` from `apps/api/.env` — do not show real secrets on screen).
6. `npm run dev` — web on `:3000`, API on `:4000`.

## Optional isolated demo sandbox (public synthetic accounts)

Use only when the lesson should show the shared demo panel. Never point demo env at the development database name `reviewdock`.

1. Copy `apps/api/.env.demo.example` → `apps/api/.env.demo` and `apps/web/.env.demo.example` → `apps/web/.env.demo.local`.
2. Align Postgres host ports with Compose.
3. `npm run demo:prepare` then `npm run demo:dev` (defaults `:3001` / `:4001`).
4. On camera, prefer the on-screen demo panel credentials; they are intentionally public synthetic identities.

Do not wipe a shared development database to prepare a recording.

## Synthetic demo data

Use readable names, for example:

| Role    | Name          | Email                    | Notes                              |
| ------- | ------------- | ------------------------ | ---------------------------------- |
| Student | Maya Chen     | maya.chen@example.com    | Fresh signup in the recording      |
| Student | Jordan Blake  | jordan.blake@example.com | Second account for draft isolation |
| Mentor  | Seeded mentor | from `MENTOR_EMAIL`      | Do not display the password        |

Project titles such as “Neighborhood Library Finder” or “Aurora Feedback Board”. Prefer public HTTPS placeholder URLs (`https://github.com/example/...`, `https://example.com/...`). Keep internal IDs out of prominent UI text.

## Useful screens and files

| Moment                         | Path / UI                                               |
| ------------------------------ | ------------------------------------------------------- |
| Landing                        | `/`                                                     |
| Student signup / login         | `/signup`, `/login`                                     |
| Submit + draft restore         | `/student/submit`                                       |
| Student projects + checkpoints | `/student`                                              |
| Mentor queue + search URL      | `/mentor?q=...&status=PENDING&page=1`                   |
| Review dialog + checkpoints    | Mentor “Review” action                                  |
| Proxy route                    | `apps/web/src/app/api/[...path]/route.ts`               |
| Review schema / service        | `apps/api/prisma/schema.prisma`, `reviews.*`            |
| Draft helper                   | `apps/web/src/features/submissions/submission-draft.ts` |

## Secret handling

- Never open `.env` files on camera.
- Prefer typing a demo password that is not used elsewhere, or paste off-screen.
- Do not commit cookies, tokens, or production connection strings.
- If the shell shows `DATABASE_URL`, scroll past credentials before recording.

## Suggested demonstration order (untimed)

1. Homepage purpose in one sentence.
2. Student signup → empty projects → submit form with draft save / reload / discard.
3. Successful submit; show pending status.
4. Mentor login → workspace totals → search by project name → URL updates → refresh / Back.
5. Approve or reject with checkpoints and a short note.
6. Student view of decision + checkpoints.
7. (Optional, brief) mention that `/api` is proxied privately and mutations require a trusted Origin.

## Still required from humans / tools

- Part 2 brief (topics, duration, language, format, submission channel).
- Screen recorder and microphone.
- Final review of captions/audio against the brief.
- Upload or LMS submission steps defined by the assessment.

## Missing inputs (do not invent)

- Detailed Part 2 lesson topics and learning objectives
- Required duration, language, format, and captions policy
- Submission channel / LMS upload steps
- Assessment deadline (if recordings must land before public repo visibility)

## Status

| Artifact                      | Status                  |
| ----------------------------- | ----------------------- |
| Technical runbook             | Prepared / updated U7   |
| Lesson outlines / narration   | Blocked on Part 2 brief |
| Recorded videos               | Not recorded            |
| Reviewed and delivered videos | Not delivered           |
