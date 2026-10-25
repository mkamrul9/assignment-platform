# Cursor prompt: U4 — student project organization and details

Work in the existing ReviewDock repository. Execute **Upgrade U4 only**. Read and follow `docs/upgrades/common.md`, the baseline, submission/auth modules, demo isolation, and completed design. Implement these useful student enhancements and verify them end to end.

## Goal

Students can find their projects quickly and understand the result of a review without an unbounded list or overloaded cards.

## Work

1. Extend `GET /api/submissions/mine` with validated `page`, `pageSize`, `status`, and optional `q`. Default page 1/pageSize 10, cap at 50, support ALL/PENDING/APPROVED/REJECTED, and define bounded search. Ownership always comes from the authenticated STUDENT. Apply filtering/counting/order/limit in PostgreSQL with explicit selections. Reject repeated/invalid/unsafe parameters and offsets.
2. Document a bounded `{ submissions, pagination }` contract, preserving the `submissions` field. Update every frontend caller, fixture, and assertion for pagination; do not retain an unbounded default path or silently drop older projects. Order by createdAt descending then ID descending, and define empty/out-of-range behavior consistently. Personal counts, if added, must be owner-scoped and independent of list filters.
3. Add `GET /api/submissions/:id` for authorized full project details. A student can read only their own project; mentors can read queue projects. Use current DB roles and a database ownership predicate. Return 404 for missing/not-visible student resources to avoid disclosing other students' records. Use safe fields, no-store responses, and deliberate route ordering around `/mine`.
4. Build a concise student projects workspace with search, status controls, pagination, clear submit action, and loading/empty/error/retry states. Keep URL state for refresh/navigation and protect against stale requests. Preserve draft recovery and duplicate/error feedback on the existing form.
5. Add a details route such as `/student/projects/[id]`, reached from project cards. Show complete plain-text description, validated links, status, review note/checkpoints, and a compact factual timeline derived from creation and the stored review. Do not invent events, reviewers, intermediate statuses, or new mutable review history. Preserve session-expiry navigation.

## Completion

Test owner isolation for list, search, totals, details, and forged query fields. Cover defaults/boundaries/statuses/search, deterministic ties, out-of-range pages, current-role/deleted-user handling, and no-store behavior. Exercise enough synthetic projects for actual multi-page browser navigation, reload/direct links, mobile/keyboard controls, and reviewed feedback. Run affected existing suites plus check/build/E2E, update API/docs/roadmap, commit, and stop before U5. Do not add editing, deletion, resubmission, or notifications.
