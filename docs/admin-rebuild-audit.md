# Master Minds administration rebuild — initial system audit

**Audit date:** 2026-11-19  
**Repository baseline:** `main` at `c459132` (`build-1179`)  
**Working branch:** `feat/admin-wallet-control-hardening`

## Executive summary

The repository already contains substantial administrative product and backend functionality; this is not a blank dashboard. `/admin`, `/super-admin`, `/root-control-portal-9xA7`, the manager workspaces, `/school/super-admin`, and multiple school-role portals coexist with separate route gates and distinct RPC contracts. The current system should be consolidated and hardened incrementally, not replaced by a second role model or backend.

No production database was queried or modified, no credentials were read or exposed, and no migration was added during this audit. This report reflects source and migration inspection in the repository; it does not claim a live-production schema comparison, authenticated browser validation, or a clean migration replay.

## What exists and should be preserved

- `src/App.tsx` retains the existing route hierarchy and `ProtectedRoute` role gates. `UserContext.tsx` obtains roles through the existing `get_user_role` RPC and rejects unavailable/invalid role resolution rather than granting a fallback role.
- `/admin` contains user search and bulk actions, account recovery, platform settings, announcements, content/report moderation, activity charts, season controls, and audit-log access. It uses existing Supabase reads and admin RPCs.
- `/super-admin` uses server-side `extreme_admin_*` RPCs for user directory, role/status/economy changes, governance, finance overview, settings and audit logs. The UI and route keep `extreme_admin` owner-only.
- `/root-control-portal-9xA7` is another owner-only control route with security configuration and privileged workflows. It must be assessed for parity before any consolidation.
- School/network tools and school portals already exist, alongside migrations for tenant isolation, provisioning, academic administration, finance, staff workflows, content approval and communications.
- The database migration history includes dedicated role, audit, school-tenant, wallet-integrity, AI-limit and admin-control changes. Existing RPC names, grants, RLS policies, triggers and school scoping are protected contracts.
- Existing student, parent, teacher, school, finance, manager and admin routes must continue to work. The Shop is an earned-coin economy, not a payment store.

## Confirmed gaps and risks

1. **Virtual wallet writes bypass the wallet contract in the regular admin UI.** `AdminPortal.tsx` wrote `profiles.coins` directly even though the current economy uses `user_currency` and trusted wallet workflows. This can fail under profile-field protections or leave the displayed/actual wallet inconsistent. The initial patch now calls the existing role-checked `admin_adjust_coins` RPC and follows it with the existing `admin_write_audit_log` RPC; it warns that the wallet write already succeeded if audit confirmation fails. These remain separate RPC transactions, so atomic write-plus-audit is not established by this patch.
2. **Operational events are being written as if they were admin actions.** The `/admin` realtime listeners call `logAction` for events such as profile updates, new users, new posts and quiz completions. Those are platform events, not actions taken by the named administrator, and should not pollute a privileged-action audit trail. They should be represented in a separate event stream only if a real backend source exists.
3. **Some dashboard time-series definitions can overstate distinct people.** The regular admin chart derives its daily `users` series from `user_presence` rows rather than distinct user IDs; `activeUsersNow` likewise counts rows. Quiz history is client-limited to 1,000 rows. Labels/calculations need correction or explicit caveats using verified data sources.
4. **The requested information architecture is not the current navigation.** The existing regular admin uses a horizontal tab strip and quick-action cards; there is no persistent permission-aware left navigation spanning the requested administrative domains. A polished responsive shell and route/page hierarchy remain outstanding.
5. **The system is split across overlapping admin surfaces.** User, moderation, system, audit and operations capabilities overlap among regular, Super Admin, Extreme Admin, Manager and school-network pages. Consolidation requires feature-by-feature parity and RPC permission review; deleting or hiding an existing portal now would risk loss of working owner-only controls.
6. **Several requested domains are backend-dependent and not yet verified.** Subscription/revenue coverage, operational service health, background-task failures, school onboarding/code generation, granular admin permissions, resource provenance, immutable moderation history, exportable analytics and notification delivery observability require contract-by-contract validation before UI claims can be made. They must remain unavailable/explicitly unsupported until real contracts are confirmed.

## Initial implementation

The review branch replaces the direct `profiles.coins` update with the established server-side wallet adjustment RPC; it validates a non-zero integer input, records actor/target/amount/result metadata through the existing server-authorized audit RPC, refreshes data, and distinguishes an audit failure from a wallet-action failure. No role, route, migration, provider, RPC signature, school policy, production record or other portal was changed.

## Remaining stages and verification limits

The complete administration rebuild is **not done**. Next work should inventory each existing admin feature and its database contract, then deliver focused reviewable slices for navigation/permissions, user and school management, academic/content moderation, operations/AI/rewards, communications/reporting, and the security/audit center. Each sensitive operation needs server-side authorization and trustworthy audit behavior; do not fabricate missing metrics.

The checkout contains Supabase migrations and pgTAP tests, but the current session has not run a clean migration replay, pgTAP, an authenticated database session, or Android/Windows builds. No live database access or production mutation was used. The PR must document those limits rather than claim the definition of done.


## Validation of the initial slice

- `npm ci --no-audit --no-fund`: passed; `package-lock.json` and `bun.lock` were unchanged. Npm emitted the repository's declared Node 24 engine requirement while the available runtime is Node 22.23.4.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 706 warnings across the existing codebase; this is not a clean-warning result.
- `npm run build`: passed; Vite reported existing chunks over 500 kB.
- `git diff --check`: passed; a source scan confirms this AdminPortal coin path no longer directly writes the `profiles.coins` field.
- No browser-authenticated workflow, Supabase migration replay, pgTAP, Edge Function check, or native platform build was run.