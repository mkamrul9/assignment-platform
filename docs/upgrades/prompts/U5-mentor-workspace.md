# Cursor prompt: U5 — mentor workspace refinement

Work in the existing ReviewDock repository. Execute **Upgrade U5 only**. Read and follow `docs/upgrades/common.md`, current queue/store/dialog code, and the detail endpoint from U4. Preserve existing correct queue search, URL state, global statistics, and atomic decisions.

## Goal

Make reviewing fast and clear without adding extra review states or dashboard decoration.

## Work

1. Refine the responsive review table, statistics, search, filters, page-size control, and pagination using the shared design. Keep status labels and student/project identity readable. Do not rebuild working server filtering/pagination in the browser. Global cards must stay independent of table search/filters.
2. Load full project/review content on demand through the authorized details API when opening a project. Keep queue rows limited to fields needed for the table. Show explicit detail-loading/retry states; cancel/ignore stale results when users close or switch projects. Never show the previous project's description or feedback under a different title.
3. Preserve a properly labelled, keyboard-contained review dialog with correct initial focus, Escape behavior, and focus restoration or a useful fallback if the trigger row disappears. Keep rejection feedback validation, checkpoint controls, notes after failed saves, saving state, and duplicate-click prevention. Avoid hidden one-key shortcuts that can accidentally decide a project.
4. Add a useful manual refresh control and clear-filter/search affordance if missing. Refresh queue and global counts deliberately; avoid polling, duplicate requests, or refresh loops. Existing URL-backed search/filter/page state must survive reload and Back/Forward.
5. After success, display the saved decision, refresh queue/stats, and recover from an emptied last page. A refresh error must not imply the committed decision failed. After 409, reload the winning details independently of whether that row is still visible on the current filtered page, refresh queue/stats, and remove stale decision controls.

## Completion

Test delayed/out-of-order detail responses, rapid filters/search/page changes, empty last-page recovery, save success followed by refresh failure, conflicting decisions under PENDING filters, failed saves preserving notes, and account changes. Exercise real desktop/mobile browser interactions and keyboard focus after a row leaves the queue. Preserve database concurrency/rollback assertions, run affected checks/build/E2E, update docs/screenshots/roadmap, commit, and stop before U6.
