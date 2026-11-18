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


# Active Plan — Grades 5–8 Product Redesign

## Scope and non-negotiables

This active plan upgrades the complete Grades 5–8 (middle tier) student experience into one cohesive, responsive product. Grades 9–12, early-tier, school, teacher, admin, parent, finance, backend behavior, Supabase contracts, route URLs, query parameters, RPCs, edge-function payloads, realtime channels, persistence keys, reward rules, mastery thresholds, and server authorization remain unchanged.

The current page redesign work is valuable but fragmented. The next phase is foundation-first migration: one middle-tier-owned shell, one typed navigation model, and one shared primitive system, followed by route-by-route migration in reviewable PRs. Existing routes remain valid; compatibility wrappers or redirects are allowed only after behavior parity is proven.

## Product architecture

The canonical Grades 5–8 information architecture is Home, Learn, Focus, Academic, Play, Connect, and Account. Every existing route is mapped exactly once to a parent group, with aliases/deep links preserved. MiddleTierShell owns global chrome; pages own content and local task controls only.

The phone bottom navigation keeps a maximum of five visible destinations: Home, Learn, Focus, Play, and Rank. The hamburger drawer exposes the remaining grouped destinations without duplicate aliases. Tablet uses a compact/collapsible rail; desktop uses a full sidebar.

## Foundation implementation

Create a typed middle-tier route metadata module containing canonical label, path, parent, child relationship, page title, active matcher, mobile visibility, grade scope, and compatibility aliases. Use it from MiddleTierShell, phone drawer, bottom navigation, page titles, breadcrumbs, and home links.

Build shared middle-tier primitives under `src/components/middle-tier/` or the existing layout/UI areas: MiddlePageFrame, MiddlePageHeader, ShellHeader, MobileSheet, ProfileMenu, StatusState, LoadingState, EmptyState, RetryState, MetricCard, ActionCard, EntityRow, PresenceBadge, UnreadBadge, SaveStatus, ConfirmAction, ProgressBar, SessionStatus, and CompletionSummary. Prefer existing Radix/shadcn primitives and semantic tokens.

Define accessible interaction behavior: semantic links for navigation, one `aria-current` destination, focus-visible states, stable accessible names, Escape/focus return/focus trap for sheets and menus, background isolation and scroll lock, numeric progress semantics, reduced-motion behavior, and state-boundary live announcements.

Use scoped `.tier-middle` tokens for foreground, muted, card, border, primary blue, accent cyan, semantic states, spacing, radius, elevation, content width, and safe-area variables. Do not modify `.tier-upper`, `.mm-studio-upper`, or other upper-tier styling.

## Migration phases

1. Contract inventory: lock route, query, provider, RPC, realtime, storage, and shell ownership contracts.
2. Navigation and shell foundation: typed route model, active matching, frame, safe-area/bottom-inset policy, scoped tokens.
3. Accessible shell interactions: sidebar, header, drawer, profile menu, bottom navigation.
4. Home parity: make MiddleTierHome canonical while preserving StudentDashboard assignments, missions, performance, friends, badges, and quick actions.
5. Learn and Focus: shared practice/session primitives; migrate Quiz/QuizFilter, Revision, Flashcards, Library, AI Tutor, Learning DNA, and Study Mode.
6. Academic workspace: unify Academic Mode terminology and migrate setup, hub, planner, insights, and topic coverage.
7. Play: align Multiplayer, Lobby, Tournaments, Leaderboard, and Store.
8. Connect: unify Social, Friends, Chat, Community, and Notifications.
9. Account and avatar: make Settings canonical, retain profile/social viewing, normalize avatar configuration and consumers.
10. Hardening: tablet rail behavior, nested-scroll/stacking fixes, freshness states, reduced motion, and route-level keyboard/screen-reader checks.

## Design direction

### Design movement

- Quiet electric learning studio — 0.04 probability: restrained Apple-like surfaces with electric blue/cyan cues and calm editorial hierarchy.
- Tactile progress playground — 0.05 probability: compact game-like feedback, purposeful motion, and friendly achievement moments without childish branding.
- Focused academic command center — 0.03 probability: structured workspace rails, dense-but-breathable data, and clear action hierarchy.

**Chosen direction: Quiet electric learning studio.**

### Core principles

1. One clear next action per screen.
2. The current place is always obvious.
3. Motion rewards progress, never competes with comprehension.
4. Every interactive state works with touch, keyboard, assistive technology, reduced motion, and slow networks.

### Color and layout philosophy

Use a calm neutral canvas with a single ownable electric blue for direction and cyan for discovery. Semantic states carry meaning; gradients never carry meaning alone. The layout is a responsive workspace: persistent navigation rail/sidebar, bounded content canvas, contextual headers, and optional rails that collapse into sheets or stacked sections.

### Signature elements and voice

Use a compact blue learning-signal line for active navigation and progress, calm metric strips for learner status, and native-feeling context sheets on phones. Keep DM Sans for body and Space Grotesk for display. Voice is direct, encouraging, and age-appropriate: “Pick your next win” and “You’re ready for one focused round.”

## Project structure

- `src/components/layout/MiddleTierShell.tsx`: sole middle-tier global chrome owner.
- `src/components/middle-tier/`: shared frame, navigation metadata, status, account, and cross-route primitives.
- `src/components/dashboard/`: Home-specific view model and presentation; preserve context/data authorities.
- `src/pages/`: route-level content migrated group by group; pages do not own global chrome.
- `src/components/ui/`: existing accessible Radix/shadcn primitives.
- `src/index.css`: scoped middle-tier tokens, responsive policies, safe-area utilities, and reduced-motion rules.
- `public/manus-routes.json`: complete route manifest, synchronized whenever route declarations change.

## Preservation rules

Do not widen middle content beyond Grades 5–8. Do not infer authoritative completion, streak history, mastery, XP, rewards, wallet balance, or saved state from client-only defaults. Do not remount stateful timers, quiz sessions, realtime rooms, LiveKit calls, library readers, or conversations during responsive/shell changes. Do not add subscriptions per visual component. Do not replace canonical data sources with demo/local-only data. Do not delete legacy routes until parity, deep-link refresh/back behavior, and representative Grades 5–8 coverage are verified.
