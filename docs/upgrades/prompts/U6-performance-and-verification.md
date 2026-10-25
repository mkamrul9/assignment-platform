# Cursor prompt: U6 — measured performance and regression verification

Work in the existing ReviewDock repository. Execute **Upgrade U6 only**. Read and follow `docs/upgrades/common.md`, the U1 baseline, and the completed upgrades. Audit actual behavior, fix demonstrated problems, and verify the application as a whole.

## Goal

Establish evidence for efficiency and correctness, rather than assuming a nicer UI or passing a build proves production readiness.

## Work

1. Run all required checks sequentially. Use fresh disposable PostgreSQL databases and synthetic users. Verify cleanup on success and induced failure; no helper may drop the configured development database or kill unrelated port owners. Verify demo mode both enabled and disabled.
2. Measure PostgreSQL query count/plans, returned row counts/payload sizes, and representative API timings with a documented larger synthetic dataset. Compare against the U1 observations using the same environment. Verify bounded student/mentor lists, no complete-queue client filtering, no N+1 fetch pattern, and coherent filtered totals/global counts while decisions occur.
3. Inspect existing indexes before adding any. Pending and owner-order indexes already exist; the ALL/newest path and contains-search need actual query-plan review. Add only justified forward indexes/migrations. Do not claim a normal B-tree fixes leading-wildcard search, add a search service speculatively, or report invented latency improvements.
4. Measure production bundle/assets and browser request behavior. Check duplicate auth/queue/stats fetches, render-triggered requests, memory/listener/timer cleanup, stale responses, account changes, font loading/layout shift, and excessive client-side imports. Keep server-only dependencies/secrets out of browser bundles. Use clear before/after evidence for changes; avoid brittle hardware-specific timing assertions.
5. Recheck auth/role boundaries, ownership, bcrypt input limits, cookie attributes, expiry/logout failure, Origin enforcement, forwarding-header spoofing, rate bucket identity and retry information, repository races, review races/rollback, and privileged-field injection. Verify production responses do not expose stack traces, tokens, hashes, or database errors.
6. Exercise the complete student-to-mentor-to-student lifecycle through the real Next.js proxy. Cover synthetic demo selection, normal signup/login, drafts, validation/duplicates, student search/filter/page/details, mentor search/filter/page/details, approval/rejection/checkpoints, reload persistence, 409 recovery, server errors/retry, session expiry, and clean logout.
7. Verify desktop and narrow mobile layouts, long content/URLs, keyboard menus/forms/pagination/dialogs, focus containment/restoration, reduced-motion preferences where animation exists, control names, and contrast. Record automation separately from manual visual inspection. Identify untested browsers/screen readers/load conditions explicitly.

## Completion

Run `check`, `build`, all four integration commands, and the full Playwright suite. Verify homepage and direct/proxied health, including health without a running database. Consult official docs for any new profiling/testing dependency. Record commands, dataset/environment, measured findings, fixes, and remaining limitations in `docs/upgrades/verification.md`. Update evidence-based roadmap status, commit, and stop before U7. Do not add unrelated product features or assert an unobserved GitHub CI result.
