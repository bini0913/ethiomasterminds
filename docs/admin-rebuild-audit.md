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

1. **Virtual wallet writes bypassed the wallet contract in the regular admin UI.** PR #594 removed the direct `profiles.coins` write. Follow-up PR #602 merged `admin_adjust_coins_with_audit`, which updates `user_currency` and inserts its `admin_audit_logs` entry in the same database function transaction, retains the legacy RPC signature with an audited fallback reason, aligns server authorization to `admin`/`extreme_admin`, and requires a reason plus confirmation in the UI. PR #602's dedicated `admin_wallet_adjustment_audit.test.sql` passed in CI, but its overall Supabase test job failed on multiple other database test issues (including missing RPC/table contracts, bad test plans, and a failing school-homework assertion); do not treat the entire database suite as green.
2. **Operational events were written as if they were admin actions.** Before PR #606, the `/admin` realtime listeners called `logAction` for profile updates, new users, new posts and quiz completions. Those are platform events, not actions taken by the named administrator. Merged PR #606 removes those audit calls but keeps session notices and data refreshes; it labels the feed as ephemeral, not a durable platform event stream.
3. **Some dashboard time-series definitions overstated people/activity.** The regular admin chart derived daily `users` from the mutable `user_presence` table and capped quiz history at 1,000 rows. The schema has a unique `user_id` constraint and client activity upserts that one row, so it cannot reconstruct historical DAU. This focused follow-up replaces that chart with exact per-UTC-day quiz-result and social-post counts, and changes the 10-minute presence count to an exact server-side count. Broader role counts, other admin surfaces, and general metric error/loading semantics still need work.
4. **The requested information architecture is not the current navigation.** The existing regular admin uses a horizontal tab strip and quick-action cards; there is no persistent permission-aware left navigation spanning the requested administrative domains. A polished responsive shell and route/page hierarchy remain outstanding.
5. **The system is split across overlapping admin surfaces.** User, moderation, system, audit and operations capabilities overlap among regular, Super Admin, Extreme Admin, Manager and school-network pages. Consolidation requires feature-by-feature parity and RPC permission review; deleting or hiding an existing portal now would risk loss of working owner-only controls.
6. **Several requested domains are backend-dependent and not yet verified.** Subscription/revenue coverage, operational service health, background-task failures, school onboarding/code generation, granular admin permissions, resource provenance, immutable moderation history, exportable analytics and notification delivery observability require contract-by-contract validation before UI claims can be made. They must remain unavailable/explicitly unsupported until real contracts are confirmed.
7. **Regular Admin user directory fetches all profile columns and is bounded to 500 rows.** The table UI and XP rankings use only identity/display, grade, XP/season XP, level, registration time and account status, but the query used `select('*')`. This focused follow-up narrows that query to those fields only. This is client projection minimization, not a database authorization boundary; effective grants and RLS still require a complete local/production history and grant verification. Search remains client-side, the 500-row ceiling and missing server pagination remain unresolved, and no sensitive profile data exposure is asserted without effective-grant evidence.

## Initial implementation

The initial PR #594 replaced the direct `profiles.coins` update with the existing server-side wallet adjustment RPC. The follow-up PR #602 added the transactional wallet-plus-audit RPC and required confirmation/reason flow; it is merged on the current repository baseline. No production records were changed by these UI/review changes. The follow-up adds a reviewable migration; its overall local Supabase test workflow did not pass in CI even though its dedicated wallet audit test passed.

## Remaining stages and verification limits

The complete administration rebuild is **not done**. Next work should inventory each existing admin feature and its database contract, then deliver focused reviewable slices for navigation/permissions, user and school management, academic/content moderation, operations/AI/rewards, communications/reporting, and the security/audit center. Each sensitive operation needs server-side authorization and trustworthy audit behavior; do not fabricate missing metrics.

The initial review checkout did not run a clean migration replay, pgTAP, an authenticated database session, or Android/Windows builds. PR #602's CI later ran a clean local replay; the dedicated wallet test passed, but the overall pgTAP suite failed, so broad database validation remains unresolved. This source audit did not query live production or mutate production records. Later PRs must state their own evidence and limits rather than claim the definition of done.


## Validation of the initial slice

- `npm ci --no-audit --no-fund`: passed; `package-lock.json` and `bun.lock` were unchanged. Npm emitted the repository's declared Node 24 engine requirement while the available runtime is Node 22.23.4.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 706 warnings across the existing codebase; this is not a clean-warning result.
- `npm run build`: passed; Vite reported existing chunks over 500 kB.
- `git diff --check`: passed; a source scan confirms this AdminPortal coin path no longer directly writes the `profiles.coins` field.
- No browser-authenticated workflow, Supabase migration replay, pgTAP, Edge Function check, or native platform build was run.

## Follow-up audit update — current main

- PR #602 is merged as `40cc265`; wallet mutation and audit insertion are now atomic through the audited RPC, with server-side `admin`/`extreme_admin` checks and a confirmation/reason flow.
- The pre-fix realtime callbacks called `logAction` for profile, post and quiz events. This follow-up removes those calls while retaining the notifications and relevant refreshes; administrator-triggered `logAction` calls are untouched.
- PR #602's dedicated wallet pgTAP file passed, but the overall Supabase CI job failed during the clean replay test suite. Reported issues included missing RPC/table dependencies in several tests, incorrect pgTAP plans, an invalid multiplayer fixture FK, and a failing school homework status assertion. The complete database suite is therefore not verified green; these failures are recorded without asserting they are all pre-existing.
- PR #606's local `npm run typecheck`, changed-file ESLint, `npm run build`, and `git diff --check` passed. ESLint reported 52 warnings and no errors in `AdminPortal.tsx`; the production build retains the repository's existing large-chunk warning. No authenticated browser test or database test was run for that UI-only slice.
- PR #606 merged as `2ad631e`; GitHub reported all 6 checks successful, including Android and Windows builds. It removes the realtime-to-audit attribution defect.
- PR #609 merged as `05012de` (merge commit); GitHub reported all 6 checks successful, including Android and Windows builds. Its UI-only change replaced the misleading historical user-activity series with exact per-UTC-day quiz-result and social-post counts, and uses an exact, unique-per-user 10-minute presence count. Historical DAU cannot be reconstructed from the current mutable presence model; no schema or production change was made.
- PR #609 local validation: `npm run typecheck` passed; changed-file ESLint reported 0 errors and 48 warnings; `npm run build` passed with the existing large-chunk advisory; and `git diff --check` passed. No authenticated browser test or database test was run.
- The next user-directory follow-up narrows the regular Admin profile projection from `*` to fields used by the directory and ranking views (`id`, `name`, `username`, `grade`, `xp`, `season_xp`, `level`, `created_at`, `account_status`). Local typecheck, changed-file ESLint (0 errors, 48 warnings), and `git diff --check` passed. This does not validate effective database grants, remove the 500-row cap, implement server pagination, or establish an authenticated user-directory workflow; no production/database query was performed.

## User-directory pagination follow-up — review pending

- The focused continuation changes the regular Admin directory from a fixed 500-profile fetch to a stable, exact-counted profile query and an on-demand next-page fetch, using the existing Supabase client and `user_roles` mapping. Role lookups are restricted to profile IDs in each loaded page; existing role precedence is retained. No schema, route, identity source, authorization contract, or production record was changed.
- Search now explicitly covers loaded name, username and ID values; email is not in the selected profile data and is not searched. Grade/role filters and bulk actions remain client-side over loaded rows, and the UI labels that scope and shows loaded-versus-total counts. This is progressive loading, not global server-side search or a finished directory; sorting/date/status/school filters and the supported recovery contract remain unresolved.
- Local validation on the feature branch: `npm run typecheck` passed; `npm run lint` completed with 0 errors and 714 repository-wide warnings; `npm run build` passed with the existing Vite large-chunk advisory; `git diff --check` passed. No authenticated browser workflow or database/pgTAP test was run. CI and PR review remain pending; this is not evidence of effective production grants or RLS.
