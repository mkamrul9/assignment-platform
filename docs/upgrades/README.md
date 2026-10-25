# ReviewDock upgrade prompts

These are execution prompts for Cursor, not completed implementation phases. The original phases and delivery history in `docs/roadmap.md` remain intact. No application behavior changes merely because these prompts exist.

## How to use

Give Cursor the full contents of **one** prompt at a time, starting with U1. Each prompt tells it to read `common.md` in this checkout. Review the phase's result and verified commit before proceeding to the next prompt. If you transfer the prompt to another checkout, transfer this directory and `docs/assessment-brief.md` too.

1. [U1: requirement audit and baseline](prompts/U1-audit.md)
2. [U2: visual system and application shell](prompts/U2-design-and-shell.md)
3. [U3: safe public demo experience](prompts/U3-demo-sandbox.md)
4. [U4: student project organization and details](prompts/U4-student-workspace.md)
5. [U5: mentor workspace refinement](prompts/U5-mentor-workspace.md)
6. [U6: performance and regression verification](prompts/U6-performance-and-verification.md)
7. [U7: documentation and delivery](prompts/U7-delivery.md)

## Product direction

ReviewDock should feel like a compact working product. Keep the useful existing features: drafts, queue search, server-side filters/pagination, checkpoint feedback, and atomic decisions. Add bounded student project browsing and an authorized project-details view with a factual submission/review timeline. Avoid unrelated features that create more unfinished flows.

U2 applies ink-blue actions, off-white/light-slate surfaces, restrained amber accents, and self-hosted Manrope; reserve semantic green/red for readable result statuses. Keep typography practical and controls accessible. Every primary navigation/footer link must lead somewhere implemented. Use concise task-focused copy, not promotional filler or implementation explanations.

U3 adds deliberately public **synthetic** identities in an opt-in sandbox (`DEMO_MODE`, `reviewdock_demo*`). Their credentials may be displayed only in that mode. The existing seeded mentor and any real student data must remain private. Public demo hosting uses its own database and configuration.

## What the brief actually requires

The quoted Part 1 features already have implementations and previous passing checks. The upgrade audit must verify this rather than manufacture a missing feature. The intentionally ambiguous brief calls for engineering judgment around ownership, URL uniqueness, rate limits, role boundaries, rejection notes, race conditions, and error states. It does not imply secret requirements for chat, notifications, AI grading, uploads, editing decisions, or an additional admin role.

## Delivery is still open

No GitHub remote or assessment deadline was configured at preparation time. A public demo UI does not make a localhost app accessible on the internet. Actual public access requires an authorized deployment target, and assessment delivery requires the intended reachable GitHub repository and post-deadline visibility checks. Keep these items and the two lessons open until the required inputs and observations exist.
