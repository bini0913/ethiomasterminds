

# Active Plan — Administration command-center visual foundation

## Scope
Upgrade the active Extreme Admin (`/root-control-portal-9xA7`) and Network Super Admin (`/super-admin`) experiences without changing their route guards, UserContext authority, Supabase RPC/function names/payloads, RLS, audit behavior, or sensitive-action confirmations. The older `SuperAdminPortal.tsx` remains non-route-owned and is not used by `/super-admin`.

## Design direction
Use an enterprise education SaaS command center: deep navy authority rail, royal blue action state, white/light-gray work surfaces, restrained semantic status colors, compact operational metrics, and clear page context. Desktop uses a persistent rail; mobile uses an accessible drawer and stacked content. Navigation labels describe the operational purpose of each section, while the existing tabs remain the behavior owner.

## Implementation boundary
`AdminCommandCenterShell.tsx` owns only visual chrome and navigation presentation. `ExtremeAdminPortal.tsx` and `NetworkSuperAdminPortal.tsx` continue to own data fetching, RPC/function calls, confirmations, permission checks, and mutation feedback. No fabricated health, analytics, finance, or audit records are introduced. Loading, empty, error, and denied states remain truthful.
