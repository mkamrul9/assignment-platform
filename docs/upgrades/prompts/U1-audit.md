# Cursor prompt: U1 — requirement audit and baseline

Work in this existing ReviewDock repository. Execute **Upgrade U1 only**. First read and follow `docs/upgrades/common.md` and the full supplied assessment brief. Proceed with the audit and authorized fixes; do not stop after a plan.

## Goal

Establish which requirements are actually implemented and which quality issues need fixing before a redesign. The original Part 1 features have previous local verification; inspect actual code and assertions rather than assuming either completion or failure.

## Work

1. Map every supplied stack/feature requirement to its implementation and meaningful integration/browser evidence. Keep GitHub reachability, observed CI, production deployment, and lesson delivery as separate statuses. Record a concise baseline in `docs/upgrades/baseline.md` with observed evidence and commands.
2. Inspect authentication/current roles, ownership, URL normalization, duplicate races, rate limits, cookie attributes/expiry, Origin protection, server filters, deterministic pagination, global statistics, competing reviews, rollback, and session/error recovery. Check that bcrypt's 72-byte input limit cannot silently change password semantics on either signup or login.
3. Inspect performance risks without guessing: unbounded `GET /api/submissions/mine`, complete descriptions/reviews in queue payloads, repeated fetching, stale/out-of-order responses, count/page consistency, search query behavior, indexes, and public-proxy client identification. Record measurements or clearly label an unmeasured risk. Defer planned browsing/detail feature work to U4/U5 and larger measured optimization to U6.
4. Fix reproduced correctness/security/quality defects within existing behavior. Add focused regression coverage. Do not add enhancement features in this phase, broadly refactor working modules, or rewrite the stack.
5. Record the upgrade decisions: blue/neutral/amber palette and Manrope; consistent navbar/footer; opt-in isolated public demo; bounded student browsing and authorized details; preservation of existing drafts/search/checkpoints and immutable reviews. These are requested enhancements, not missing assessment requirements.

## Completion

Run the existing checks needed for fixes, establish the baseline of all integration/browser suites, and distinguish failures from environment blockers. Do not claim hidden assessment requirements or perfect production readiness. Add U1 status/evidence to the roadmap, commit the verified work, and stop before U2.
