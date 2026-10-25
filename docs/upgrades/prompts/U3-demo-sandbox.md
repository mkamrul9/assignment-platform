# Cursor prompt: U3 — safe public demo experience

Work in the existing ReviewDock repository. Execute **Upgrade U3 only**. Read and follow `docs/upgrades/common.md`, the baseline, seed/environment code, auth/session implementation, and completed U2 design. Implement and verify this phase.

## Goal

Visitors can try student and mentor workflows using visibly advertised synthetic accounts on login and signup screens, without exposing real accounts or weakening authentication.

## Work

1. Add an explicitly opt-in demo mode that is disabled by default. Use a dedicated, allowlisted demo database and separate environment/run configuration; never convert or seed the current development/real-data database into a public sandbox. Preserve existing environment files, mentor credentials, and database ports. Provide clearly named seed/run commands for the separate demo configuration, with useful guard failures.
2. Seed two synthetic students and one synthetic mentor, plus at least 25 representative projects spanning pending/approved/rejected states and consistent review rows. Seed normal bcrypt hashes. Use stable fixture identities so repeated seeds neither duplicate records nor reset passwords/decisions. Fail on account/role collisions rather than promoting or overwriting existing users. Sample data must be identified as demo data.
3. Provide a shared compact demo-account panel on login and signup. Show only intentionally public synthetic credentials. Role-labelled actions should lead to the normal login flow and prefill the selected known account; signup must not attempt to recreate an already-seeded account. Preserve manual login/signup and accessible labels/loading/errors. Do not place credentials in URLs or browser storage.
4. Demo authentication must still use normal Express login, JWT cookies, current database roles, trusted Origins, and rate limits. Never expose the existing `MENTOR_PASSWORD`, JWT secret, database URL, password hashes, or arbitrary configured credentials in a public endpoint or browser bundle. The account panel and any public demo metadata endpoint must be absent/404 when demo mode is off.
5. Treat public demo credentials as deliberately public sample data, not a production secret. Public demo deployment must have its own database and no access to real users. Do not implement a public reset endpoint, automatic reset on startup, or destructive reseeding. If an explicit reset command is needed, guard it to the dedicated sandbox, document its destructive scope, and never run it against existing data.
6. Document that shared demo students share their account's data and rate bucket; demo mentor actions are real and final within the sandbox. Do not silently disable limits to make the demo work. Address the known Next-to-Express shared-IP topology through a verified ingress configuration for public hosting. Local configuration alone does not make the demo internet-accessible.

## Completion

Add disposable-DB checks for seed idempotence, role collisions, hash verification, synthetic state consistency, and refusal to seed/reset a non-demo database. Add browser checks for both auth panels, student/mentor sign-in, normal signup, valid cookie behavior, and complete absence of demo credentials/UI when disabled. Run affected existing suites, check/build, update environment examples and docs without real secrets, commit, and stop before U4.
