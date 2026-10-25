# Cursor prompt: U2 — visual system and application shell

Work in the existing ReviewDock repository. Execute **Upgrade U2 only**. Read and follow `docs/upgrades/common.md`, the U1 baseline, and the existing code before editing. Preserve working features and proceed through implementation and verification.

## Goal

Make the app feel coherent and easy to navigate with a distinct visual identity. This is a focused redesign of existing pages, not a marketing site or framework rewrite.

## Work

1. Replace the current primary-green and Georgia/Segoe UI treatment with ink-blue actions, off-white/light-slate surfaces, and restrained amber accents. Keep semantic success/error/status colors accessible and textual. Define shared Tailwind/shadcn tokens for colors, type, spacing, borders, and focus instead of scattering values.
2. Use self-hosted Manrope with system fallbacks. Verify font licensing, commit required notices/assets appropriately, and use Next's supported font integration. Load only needed weights/styles, avoid render-blocking remote font requests, and keep production builds independent of Google Fonts availability. Use the same family consistently for controls and headings.
3. Provide shared responsive navbar and footer components across public, auth, and workspace layouts. Include active navigation, role-aware workspace links, real student submit/project destinations, and existing logout/loading/error behavior. Workspace navigation must remain accessible on mobile rather than hiding the only return link. Avoid duplicate headers/footers between layouts.
4. Refine the homepage with a concise value proposition, clear student/mentor entry actions, a short real workflow section, and a footer with implemented destinations. Retain meaningful content without repetitive slogans, huge blank regions, placeholder metrics, or fake product imagery.
5. Restyle signup/login and both workspaces consistently. Preserve labels, autocomplete, field errors, drafts, filter/query state, sessions, review dialog semantics, and existing API contracts. Do not add the demo functionality before U3 or render a non-functional demo button.

## Completion

Run check/build and affected browser tests. Exercise public/auth/student/mentor navigation at desktop and 360–390px widths; check keyboard focus, menus, dialog focus restoration, text contrast, long values, and page overflow. Keep meaningful existing assertions and update selectors only when necessary. Capture synthetic screenshots, update the design decisions and relevant docs, commit, and stop before U3.
