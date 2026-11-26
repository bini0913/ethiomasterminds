

# Active Plan — Administration command-center visual foundation

## Scope
Upgrade the active Extreme Admin (`/root-control-portal-9xA7`) and Network Super Admin (`/super-admin`) experiences without changing their route guards, UserContext authority, Supabase RPC/function names/payloads, RLS, audit behavior, or sensitive-action confirmations. The older `SuperAdminPortal.tsx` remains non-route-owned and is not used by `/super-admin`.

## Design direction
Use an enterprise education SaaS command center: deep navy authority rail, royal blue action state, white/light-gray work surfaces, restrained semantic status colors, compact operational metrics, and clear page context. Desktop uses a persistent rail; mobile uses an accessible drawer and stacked content. Navigation labels describe the operational purpose of each section, while the existing tabs remain the behavior owner.

## Implementation boundary
`AdminCommandCenterShell.tsx` owns only visual chrome and navigation presentation. `ExtremeAdminPortal.tsx` and `NetworkSuperAdminPortal.tsx` continue to own data fetching, RPC/function calls, confirmations, permission checks, and mutation feedback. No fabricated health, analytics, finance, or audit records are introduced. Loading, empty, error, and denied states remain truthful.

## Extreme Admin redesign slice
The Extreme Admin now lands on a data-backed Overview command center with scale metrics, attention queues for pending reports and privacy requests, control-assurance values from the existing security RPC, and quick navigation into users, schools, and audit logs. The detailed sketch-by-sketch interaction and responsive contract lives in `docs/extreme-admin-world-class-redesign.md`.


# Active Plan — Extreme Admin control-plane restructure

## Scope and preservation
Replace the Extreme Admin page composition around the existing `AdminCommandCenterShell` without changing routes, role gates, Supabase RPCs, sensitive-action confirmations, or database authorization. The route becomes a true standalone workspace: no generic app history header, no duplicate mobile tab strip, and no second navigation model. All current sections and live data remain available.

## Information architecture
Use one grouped navigation model: Command center (Overview), People & access (Users, Super Admin, Schools), Trust & privacy (Reports, Deletion requests), Platform (Finance, Rewards & economy, Content, Chats), and Control plane (System settings, Audit logs). Keep the active destination in the URL-free local tab state used by the existing page, while the shell owns desktop sidebar, mobile drawer, current context, refresh, and logout.

## Design direction
- **Movement:** quiet enterprise control plane — deep navy orientation rail, bright but restrained action color, white operational canvas, and compact state signals.
- **Core principles:** one navigation source, one clear task context, sensitive actions stay visibly consequential, and platform truth remains more important than decorative density.
- **Layout paradigm:** persistent desktop rail plus contextual top bar; mobile drawer replaces the rail; main content is a bounded operational canvas with queue-first overview composition.
- **Signature elements:** grouped rail headings, protected-access status pill, and a portal-owned logout/refresh cluster.
- **Interaction:** keyboard `⌘K`/`Ctrl+K` opens navigation, active sections use `aria-current`, mobile navigation closes after selection, and logout/refresh preserve pending states.
- **Typography and brand:** reuse DM Sans and Space Grotesk with the existing Master Minds identity; no new backend or competing visual brand.

## Files and validation
- `src/components/admin/AdminCommandCenterShell.tsx`: grouped navigation, responsive shell, portal-owned controls.
- `src/pages/ExtremeAdminPortal.tsx`: grouped nav metadata, standalone logout wiring, removal of duplicate mobile tabs.
- `src/App.tsx`: bypass generic app chrome for the standalone Extreme Admin route.
- Preserve `public/manus-routes.json`; no route change is introduced.
- Validate with typecheck, lint, production build, route manifest check, and `git diff --check`; authenticated Supabase-backed browser behavior remains outside available evidence unless a session is supplied.
