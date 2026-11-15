# Grade 9–12 Figma Make UI port

## Outcome
Replace only the current Grades 9–12 student-facing visual experience with the supplied Figma Make direction, while retaining this repository’s real Supabase-backed data flows, authentication, route guards, and non-upper-tier portals. The Figma prototype is a visual/interaction reference; its sample student and mock values must not replace live account data.

## Implementation approach
- Reuse the existing React 18/Vite/TypeScript/Tailwind/shadcn/React Router/Supabase architecture and current upper-tier shell, semantic theme tokens, route pages, contexts, and mutations wherever they satisfy the design.
- Inventory the existing route map and Figma’s 31 route patterns. Give all supported Grade 9–12 journeys coherent navigation and Figma-aligned responsive layouts; adapt existing route components rather than creating parallel fake pages.
- Remove superseded upper-tier-only UI composition after confirming each existing feature and route still renders for its existing audience. Preserve the shared StudentDashboard implementation and all early/middle/staff/family/admin/finance routes and role/tier checks.
- Apply the Figma visual language: warm near-white surfaces, deep ink, teal primary action, restrained amber/coral, generous whitespace and 8px rhythm, accessible typography/contrast, shared responsive shell, uncluttered mobile layout, safe-area-aware bottom navigation and content clearance. Respect existing dark, pink and blue theme tokens.
- Keep authentic loading, empty, error/retry, success, and permission states. Connect controls to existing Supabase/API/query/action paths; no prototype-only fixed student data or success claims.
- Add/update `public/manus-routes.json` if needed before starting a dev server, derived from actual routes. Avoid destructive database changes.

## Project structure
- `src/App.tsx`: application providers, protected routes, and shared page shells; preserve route/role/tier behavior.
- `src/pages/`: route screens and page-level data/action integration.
- `src/components/dashboard/` and `src/components/upper-tier/`: Grades 9–12 home, navigation, and shared shell pieces.
- `src/components/layout/`: shared shell and responsive navigation.
- `src/index.css`, Tailwind config: semantic roles, theme variants, breakpoints and UI styling.
- `src/integrations/supabase/`, contexts/hooks, and `supabase/`: existing backend client, data ownership and server/database behavior; modify only for a demonstrated functional gap.
- `public/manus-routes.json`: published page route manifest where applicable.

## Constraints
- Scope is exclusively replacement of the old Grade 9–12 student UI, not deletion of shared functionality or other grade-band/role portals.
- Preserve all existing Supabase data ownership, auth, role/tier guards, and security policies; do not reset or delete production data.
- Do not claim authenticated end-to-end validation without testing with an authenticated student account.
- Work on `feat/figma-upper-tier-ui`; do not rewrite `main` history or force-push.

## Design direction
- **Design Movement:** polished academic SaaS, informed by Figma’s warm, spacious student workspace.
- **Core Principles:** make the next study action obvious; give progress room to breathe; retain familiar routes and real data; adapt navigation to screen size.
- **Color Philosophy:** warm near-white and deep navy for calm focus, teal for action/progress, amber and coral only for high-signal moments; theme roles must remain compatible with dark/pink/blue modes.
- **Layout Paradigm:** desktop persistent sidebar and quiet top bar; mobile drawer and compact bottom navigation, with one-column-first cards and scroll-safe content.
- **Signature Elements:** slim teal progress indicators; softly bordered study cards with restrained accent marks; clear active navigation state.
- **Interaction Philosophy:** immediate, accessible feedback; links/actions retain existing behavior; no dead prototype controls.
- **Animation:** subtle short state transitions only, honor reduced-motion and avoid shifting layout.
- **Typography System:** reuse existing DM Sans/Space Grotesk design tokens; clear page title, section labels and readable body copy.
- **Brand Essence:** focused Ethiopian secondary-school learning workspace; thoughtful, confident, motivating.
- **Brand Voice:** concise and supportive. Examples: “Pick up where you left off.” “A short focused session moves you forward.”
- **Wordmark & Logo:** retain the project’s existing Ethiomasterminds mark; no new competing logo.
- **Signature Brand Color:** teal, used through semantic primary roles rather than hard-coded one-off values.
