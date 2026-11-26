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


# Active Plan — Master Minds Administration System Rebuild

## Scope and implementation approach

Upgrade the existing administration product in controlled, reviewable slices. Treat the repository inventory and `docs/admin-rebuild-audit.md` as the Stage 1 baseline. Preserve the existing React/Vite/TypeScript/Tailwind/Supabase architecture, authentication/UserContext, routes, role lookups, admin and school RPC contracts, RLS, Firebase, LiveKit and Vercel. Reuse current portals and migrations; do not create a second backend or role system. Never invent data, expose secrets, weaken security, mutate production records for a demo, or merge a PR.

Establish a single admin navigation/page hierarchy and an explicit permission map grounded in existing database-enforced roles. Build a deep-navy, royal-blue, white/light-gray shell with restrained state colors, Lucide icons, responsive persistent desktop sidebar, accessible mobile drawer and real system state. Keep presentation separate from data/action services. Use real server/database contracts for every action; add schema changes only for demonstrated gaps after reviewing full local and production migration/RLS/RPC dependencies. Preserve owner-only Super Admin and the school tenant boundary.

## Delivery slices

1. Audit current route/page capabilities, auth/role gates, all applicable RPC and table contracts, migrations/RLS/tests, and production migration evidence; document supported, incomplete, broken and preserved behavior.
2. Correct high-confidence existing workflow defects with current authorized server contracts (initial slice: virtual-wallet adjustment must call `admin_adjust_coins`, never write `profiles.coins`, and report audit state honestly).
3. Consolidate the information architecture in focused pieces without removing or masking an existing working role portal before parity; implement shared loading/empty/error/denied/responsive patterns.
4. Incrementally connect user/school/academic/content/operations/AI/reward/communications/analytics/finance/security/settings modules to existing APIs and permission checks; add migrations only when required.
5. Verify changed code with available typecheck/lint/build and relevant SQL/browser checks; distinguish source-only evidence from authenticated production validation. Deliver focused PRs with database/security impact, evidence and limitations. Never merge.

## Project structure

- `src/App.tsx`: canonical existing route tree and role gates; preserve URLs and redirects.
- `src/pages/AdminPortal.tsx`, `SuperAdminPortal.tsx`, `ExtremeAdminPortal.tsx`, `SchoolGlobalAdminPortal.tsx`, and existing school/manager/finance portals: current feature owners to inventory and consolidate only with parity.
- `src/components/portals/` and `src/components/admin/` (where a shared module is justified): shared admin navigation, states, data views and confirmations.
- `src/lib/` or existing integration/service modules: typed business actions and access to current RPC contracts, kept out of page presentation.
- `src/context/UserContext.tsx`: existing identity/role loading authority; do not create a duplicate.
- `supabase/migrations/` and `supabase/tests/`: authoritative schema/security changes and tests; do not add migrations for cosmetic needs.
- `docs/admin-rebuild-audit.md`: evidence-based baseline and unverified limits.

## Design direction

- **Movement:** enterprise education SaaS command center.
- **Principles:** trustworthy real data; precise role-aware actions; clear operational hierarchy; responsive, accessible dense information.
- **Color philosophy:** deep navy for authority and orientation, royal blue for action, light surfaces for legibility, muted green/amber/red only for state.
- **Layout:** persistent desktop left rail and contextual top bar; collapsible groups; mobile top bar and accessible drawer with stacked data views.
- **Signature details:** understated active navigation marker, compact operational state labels, crisp bordered panels.
- **Interaction and motion:** direct confirmation for sensitive operations, clear pending/success/error states, keyboard/touch support, restrained transitions and reduced-motion compliance.
- **Typography:** reuse current application typography tokens; maintain a clear title/section/body hierarchy.
- **Brand:** Master Minds, “Learn. Compete. Level Up.”; professional, precise, protective. Example copy: “Review the source before approving.” “This change is recorded to the admin audit trail.”
- **Logo and brand color:** retain the existing Master Minds identity; no competing mark or unapproved gradient treatment.

## Preservation and constraints

Keep all existing student/parent/teacher/school/admin routes available; do not redesign non-admin portals. School administrators remain school-scoped. Only Super Admin retains the authority provided by existing owner-only backend contracts. Role/account changes, wallet writes and other privileged actions require authoritative server authorization and trustworthy audit records. Do not fabricate service health, operational events, usage, school subscriptions or financial records. The initial audit demonstrates that some RPC operations and their client-side audit calls are separate transactions; do not describe such logging as atomic until a tested database contract provides atomicity.


# Active Plan — World-Class Digital Library Redesign

## Scope
Replace the existing `/library` presentation and information architecture with a focused library home, personal shelf, and distraction-free reader. Preserve the existing route, Supabase data contracts, role/tier filtering, uploads, moderation, bookmarks, downloads, reading progress, highlights, notes, AI actions, loading states, and permissions.

## Implementation
- Keep `src/pages/LibraryPage.tsx` as the route owner, but rebuild its presentation around clear primary and secondary destinations.
- Use real `libraryApi` data; do not add demo books or invented progress.
- Use a desktop rail and compact mobile section switcher. Put management actions behind contextual menus.
- Keep the PDF reader as a full-screen dialog. Expose AI and annotation tools only when requested, with a responsive stacked layout.
- Preserve accessible Radix dialogs, visible focus, labels, keyboard operation, reduced-motion behavior, and safe-area spacing.
- Use a restrained Apple-inspired glass system for navigation, cards, dialogs, and reader tools: translucent semantic surfaces, subtle blur, crisp borders, soft depth, and opaque fallbacks when backdrop filtering is unavailable.

## Design direction
- **Movement:** quiet editorial reading studio.
- **Core principles:** one next action; calm reading surface; progressive disclosure; truthful learning state.
- **Color philosophy:** warm paper-like canvas with teal/blue action color and restrained semantic accents; theme tokens remain semantic and compatible with existing themes.
- **Layout paradigm:** bounded reading canvas with a persistent desktop rail, compact mobile switcher, and full-screen reader overlay.
- **Signature elements:** reading-progress spine, quiet cover cards, contextual tool drawers.
- **Interaction philosophy:** read first, save second, manage only when needed; every async mutation communicates its state.
- **Animation:** short card entrance/hover only, disabled under reduced motion; no motion inside the reading surface that competes with comprehension.
- **Typography:** existing Space Grotesk display and DM Sans body tokens, with generous reading line-height.
- **Brand essence:** a calm Ethiopian learning library that helps students find, understand, and remember useful material.
- **Brand voice:** direct and supportive — “Pick up where you left off.” and “Find the next useful resource.”


# Active Plan — World-Class Community Redesign

## Scope and preservation

Upgrade the complete Connect experience across `/social`, `/social/community`, `/friends`, and `/chat`. Preserve the current React/Vite/Tailwind/shadcn architecture, route URLs, tier restrictions, CommunityTermsContext consent flow, FriendsContext actions and realtime subscriptions, SocialFeedView Supabase queries/mutations, direct/group messaging RPCs, report/block workflows, and all existing RLS contracts. This phase changes information architecture, presentation, responsive behavior, and visible async states; it does not introduce a second social backend or replace live data with demo content.

## Community information architecture

The canonical Connect model is **Hub → Community → Friends → Messages**. The hub is a calm launchpad with live network signals and three purposeful next actions. Community is a feed workspace with Explore, Following, Trending, Study, and Challenges as one persistent filter model. Friends is a two-pane relationship workspace: people and requests on the left, the selected conversation or discovery task on the right. Messages keeps group-chat behavior in its dedicated route and uses mobile list-to-conversation navigation. Deep links and existing query parameters remain valid.

## Implementation approach

- Add a shared `CommunityFrame` primitive for page heading, section eyebrow, route-level navigation, live network metrics, and responsive content width. Pages remain responsible for their own data and actions.
- Recompose `SocialHub`, `EnhancedSocial`, and `Friends` around semantic sections instead of unrelated card collections. Use the existing `glass` surface system with opaque semantic fallbacks and theme-safe tokens.
- Keep `SocialFeedView`, `FriendsContext`, `Chat`, `EnhancedChatSystem`, `CreatePostModal`, reports, blocks, and terms as behavior authorities. Improve their surrounding presentation and add safe local pending/error/retry states only where no backend contract changes are required.
- Use a desktop workspace rail/pane pattern, tablet split layout, and mobile stacked/list-to-detail behavior. Never require horizontal scrolling for primary actions; secondary filters may scroll with visible focus and labels.
- Make async states truthful: loading skeletons preserve layout, errors provide retry, empty states explain the next action, and pending buttons disable only the action in flight.

## Design direction

### Movement
Quiet social learning studio — 0.06 probability: editorial community workspace with translucent glass layers, soft depth, and a single electric learning signal.

### Core principles

1. Make the next social learning action obvious.
2. Keep people, content, and conversations distinct but connected.
3. Show live state without overstating freshness or authority.
4. Make every interaction comfortable on touch, keyboard, assistive technology, and reduced motion.

### Color philosophy and signature elements

Use the existing semantic theme roles. The canvas stays calm and low-contrast; primary blue/teal identifies movement and active state, violet marks messages, amber marks challenges, and success/destructive roles retain their meaning. Signature elements are a slim active-route signal, layered glass panels with crisp borders, and compact live-status pills rather than decorative gradients.

### Layout paradigm

Use a bounded responsive workspace rather than a centered marketing grid: contextual top bar, optional left navigation/list pane, focused content column, and a supporting rail that collapses into inline cards on smaller screens. Mobile uses a sticky action bar and list-to-detail transitions; desktop preserves simultaneous context.

### Interaction, motion, and accessibility

Use semantic links for navigation and buttons for actions, one `aria-current` route, visible focus rings, stable accessible names, minimum touch targets, Escape-safe dialogs, and reduced-motion fallbacks. Motion is short and state-based: list insertion, selection, and success feedback only; no perpetual decorative animation. Pending states belong to the exact action being submitted. Community terms and safety actions remain blocking and explicit.

### Typography and voice

Reuse Space Grotesk for display and DM Sans for body. Page titles are compact and confident; supporting copy explains what happens next. Voice examples: “Find your people and your next good idea.” and “Share something useful, then keep learning.”

## Project structure

- `src/components/community/CommunityFrame.tsx`: shared Connect heading, route switcher, live metrics, and responsive frame.
- `src/pages/SocialHub.tsx`: network launchpad and live summary actions.
- `src/pages/EnhancedSocial.tsx`: feed workspace and challenge discovery.
- `src/components/social/SocialFeedView.tsx`: live post data and social mutations; presentation hardening only.
- `src/pages/Friends.tsx`: friend discovery, requests, and direct conversation workspace using `FriendsContext`.
- `src/pages/Chat.tsx`: group/public messaging workspace with existing realtime/RPC authority.
- `src/context/FriendsContext.tsx` and `src/context/CommunityTermsContext.tsx`: behavior, permission, consent, and realtime owners; do not duplicate them in visual components.
- `src/index.css`: shared semantic glass/responsive policies; avoid changing upper-tier-only contracts.


## Feed interaction slice

The next reviewable slice deepens the feed without changing its data authority. Post cards use separated glass surfaces and deliberate rhythm; likes, reactions, follows, saves, and comments expose per-post pending locks; comments expose loading and retry boundaries; the composer validates image input, cleans preview URLs, enforces its content limit, and keeps submit/close states truthful. All mutations continue to use the existing tables, `runWithCommunityTerms`, and realtime refresh paths.
