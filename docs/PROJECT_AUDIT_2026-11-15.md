# Master Minds repository audit

**Repository:** `bini0913/ethiomasterminds`  
**Audited checkout:** `main` at `8992286` (2026-11-15)  
**Planned working branch:** `feat/figma-upper-tier-ui` at `9ae8b4d`  
**Audit date:** 2026-11-15

## Executive summary

Master Minds is already a substantial production-oriented learning platform, not an empty or early prototype. The repository contains a React/Vite frontend, Supabase database and Edge Functions, Android/Capacitor packaging, Electron packaging, CI/CD workflows, a large migration history, and a Grade 9–12 Figma redesign in progress.

The main risk is not a lack of features. It is the gap between feature breadth and verified product quality. The next work should be a controlled completion pass for the Grade 9–12 experience, backed by route-by-route authenticated verification, release reproducibility, and a small set of concrete data-boundary fixes. We should not rewrite the backend or delete unrelated portals.

## Inventory

| Area | Evidence |
|---|---:|
| Frontend source | 235 files / about 56,514 LOC under `src` |
| Supabase Edge Functions | 16 files / about 2,468 LOC |
| SQL migrations | 172 files / about 29,216 LOC |
| SQL security/integrity tests | 13 files / about 633 LOC |
| Android project | 61 tracked files / about 3,069 LOC |
| Application routes | 52 router entries including the catch-all; 51 manifest routes |
| Backend migration patterns | about 189 table declarations, 402 function declarations, 456 policy declarations, 202 RLS enablements, and 65 trigger declarations |
| Large frontend hotspots | `Lobby.tsx` 1,625 LOC; `TeacherPortal.tsx` 1,601; `AdminPortal.tsx` 1,408; `ManagerDashboard.tsx` 1,234; `UserProfilePage.tsx` 1,082; `LibraryPage.tsx` about 1,000 |

The source inventory covered application pages, reusable components, contexts/hooks, Supabase client/types/functions/migrations/tests, public assets and route manifest, mobile/desktop wrappers, workflow files, configuration, and project documentation. Generated image/icon resources and the shadcn primitive set are present and should be treated as supporting assets rather than product gaps.

## Baseline verification

| Check | Result | Notes |
|---|---|---|
| `npm ci` | **Fails** | The committed `package-lock.json` is out of sync with the dependency graph; npm reports missing optional `@esbuild/*`, `minimatch`, `path-scurry`, `brace-expansion`, and related entries. |
| `npm install --ignore-scripts --no-package-lock --no-audit --no-fund` | **Passes** | Used only to establish a clean local dependency tree without modifying manifests. |
| `npm run typecheck` | **Passes** | Both app and node TypeScript projects pass. |
| `npm run lint` | **Passes with warnings** | No errors; warnings are concentrated in explicit `any` usage and missing React hook dependencies. |
| `npm run build` | **Passes** | Vite production build succeeds; the existing large-chunk warning remains. |
| Frontend automated tests | **Missing** | `package.json` has no test script and no frontend test suite was found. |
| Supabase SQL tests | **Present but not wired into CI** | 13 pgTAP-style SQL tests exist, but no repository script/workflow executes them automatically. |
| Authenticated browser verification | **Not performed** | Requires a real authenticated student account and should not be claimed until completed. |

The local environment ran Node `22.23.4`, while `package.json` requires Node `24.x`; CI explicitly installs Node 24. This should be standardized before release work.

## Repository and branch findings

The project plan and TODO explicitly say to work on `feat/figma-upper-tier-ui`. That branch exists remotely and contains the Grade 9–12 Figma-aligned dashboard commit. The current clone is on `main`, so implementation work should first create/switch to a local working copy of that feature branch rather than making redesign changes directly on `main`.

The README is still the generic Lovable starter README. It does not describe Master Minds, the actual Supabase deployment model, the route families, mobile/desktop packaging, or the required environment variables. It is a release and onboarding gap, not a runtime blocker.

## Frontend audit

### What is already implemented

- React 18 + Vite + TypeScript + Tailwind + shadcn primitives.
- Lazy-loaded route pages with a route error boundary and suspense fallback.
- Central providers for user/auth, tier, theme, language, currency, quiz, achievements, rooms, chat, friends, and AI helper state.
- Protected routes and tier/role gates for student, teacher, admin, manager, finance, and extreme-admin areas.
- Separate early-learner, middle/shared-student, upper-tier, family, staff, and operations portals.
- Grade 9–12 shell work in `App.tsx`, `UpperTierStudioShell`, upper-tier sidebar/topbar/mobile dock, semantic theme tokens, and responsive bottom-navigation behavior.
- Real Supabase-backed flows for academic setup, quizzes, exam practice, flashcards, topic coverage, planner, library, insights, Learning DNA, multiplayer, social, profile, rewards, study calls, notifications, and AI features.
- Loading/error/retry states in many pages, with existing project documentation explicitly tracking the remaining route-level verification.

### Frontend gaps to prioritize

1. **Route-by-route UX completion is still unverified.** The existing UX audit correctly marks all route phases as incomplete. The most important unfinished work is not adding screens; it is checking direct URL entry, refresh, back/home, active navigation, mobile/tablet/desktop layout, empty/error/retry states, mutation pending states, keyboard focus, and tier/role boundaries for the Grade 9–12 route set.
2. **The Grade 9–12 design is only partially unified.** The shell is Figma-aligned, but the route pages are a mixture of newer academic pages and historical feature screens. The next pass should standardize shared page title/section/card/action patterns without replacing working data flows.
3. **Frontend typing is weak at integration boundaries.** There are many `as any`/`any` casts, especially in admin, manager, finance, multiplayer, library, planner, dashboard, and AI screens. This hides schema drift and makes runtime regressions harder to detect. Prioritize the Grade 9–12 pages and shared APIs first instead of attempting a whole-repository typing rewrite.
4. **No frontend journey tests exist.** Add a small testable foundation for route guards, tier routing, profile bootstrap, quiz submission/reward confirmation, academic setup persistence, and planner/library failure states. A full page snapshot suite is not the right first move.
5. **Some state remains browser-local.** Profile bio, book analysis cache, selected planner books, early discover history, competitive-system data, and onboarding flags use local/session storage. This is acceptable only when explicitly intended. Any progress, identity, social, or academic state that users expect across devices should be verified and moved to Supabase where necessary.
6. **Potential dead-end behavior remains.** Early videos intentionally show “coming soon” when no approved content exists, which is honest but should have a clear content/admin path. Several legacy components/utilities remain as compatibility layers and should be removed only after confirming their routes no longer depend on them.
7. **Accessibility/performance needs evidence.** The app has semantic and reduced-motion work, but there is no automated accessibility pass, no recorded viewport matrix, and Vite reports a large chunk advisory. Verify first; optimize only the largest user-facing bundles after route behavior is stable.

## Backend audit

### What is already strong

- A mature Supabase migration history with explicit hardening batches through 2026-11-14.
- Extensive RLS and policy coverage, server-authoritative reward/economy paths, rate-limited Edge Functions, role RPCs, multiplayer integrity work, and authenticated RPC-surface tests.
- Edge Functions for AI tutor/helper/planner/insights, Learning DNA, parent insights, library AI, username auth, role assignment, rewards, missions, notifications, voice evaluation, and LiveKit study calls.
- `supabase/config.toml` enables JWT verification for protected functions; username availability/login is deliberately public but performs its own validation/rate limiting.
- Production deployment documentation correctly warns that the production migration history was reconciled and that blind `supabase db push` must not be used outside the controlled workflow.

### Concrete backend/data gaps

1. **Environment documentation is inconsistent.** `.env.example` points to Supabase project `midsuuwyqlsmzyfvhdzy`, while `supabase/config.toml`, deployment documentation, CI workflows, and production builds point to `mytbjkchvfybhyqcynnl`. The example file must be corrected or explicitly labeled as a separate development project. This is the highest-priority release hygiene issue because a fresh local setup can connect to the wrong backend.
2. **The production database deployment workflow conflicts with its own documentation.** The docs say not to run a blind production push until migration history is reconciled, but `.github/workflows/supabase-deploy.yml` automatically runs `supabase db push` whenever migration files change. Before more database work, confirm the production migration state and add a safe reconciliation/approval guard; do not “fix” this by deleting migrations.
3. **Account deletion is not implemented.** `UserContext.deleteAccount()` signs the user out and tells them to contact support; it does not delete the account or associated data. The UI must either be explicitly renamed to “Sign out / request deletion” or a secure deletion request/backend flow must be designed.
4. **Role/user loading has avoidable client-side fan-out.** `getAllUsers()` loads all profiles and then calls `get_user_role` once per profile. Admin/manager pages also contain broad client-side casts and multi-request enrichment. Prefer the existing privileged RPC pattern for paginated, role-aware listings.
5. **SQL tests are not part of the release gate.** The tests are valuable but are not called by npm or GitHub Actions. Add a controlled Supabase test job that targets an isolated/test project or a safe schema; never run destructive pgTAP setup against shared production data.
6. **Typed generated schema is incomplete for the actual architecture.** `drizzle/schema.ts` is intentionally blank, while the real backend source of truth is Supabase migrations and generated Supabase types. This is not itself a defect, but Drizzle config should be removed or documented as unused to avoid implying a second database/migration system.
7. **Edge Function observability is thin.** Functions generally return controlled JSON errors and rate-limit AI calls, but there is no shared structured error/request ID convention or documented alerting path for failed AI, push, LiveKit, or reward workflows. Add this after functional verification, not before.
8. **External provider configuration needs a release checklist.** AI functions require `GROQ_API_KEY`; study calls require LiveKit keys/URL; push notifications require FCM service-account JSON; scheduled missions require a cron secret. These are documented only partially and should be enumerated in a safe deployment checklist without committing secrets.

## Security and privacy review priorities

The project has clearly invested in security, including recent migrations for authenticated RPC surfaces, search paths, multiplayer integrity, profile fields, wallet actions, daily rewards, exam submissions, and anonymous privilege revocation. The next security pass should therefore be targeted:

- Verify each Grade 9–12 route against both client guard and server/RLS behavior.
- Verify parent/teacher/admin data scoping with accounts representing each role.
- Confirm social/chat defaults and age/tier restrictions for younger learners are not weakened by shared navigation changes.
- Replace client-controlled or browser-local sources of durable learning/progression data where cross-device integrity matters.
- Add regression tests for any confirmed gap rather than creating broad speculative migrations.

## Route coverage and manifest

The route manifest contains every concrete router path found in `App.tsx`; the only apparent router-only entry is the intentional `*` catch-all. The manifest currently includes the Grade 9–12 routes listed in the plan, including academic setup/topics/flashcards/exam/entrance papers/planner/insights, study mode, library, AI tutor, Learning DNA, multiplayer, social, profile/settings/notifications, and parent dashboard.

The manifest should still be rechecked after every route change. It should not be used as evidence that the route journeys are functionally complete.

## Recommended 9–12 completion sequence

### Session 1 — branch, environment, and release baseline

- Switch to `feat/figma-upper-tier-ui`.
- Correct/document `.env.example` so it matches the intended development/production project model.
- Regenerate and commit `package-lock.json` using Node 24, or intentionally standardize on the package manager/lockfile used by CI.
- Update the README with setup, environment variables, Supabase deployment caution, route families, and Android/Windows build commands.
- Add a safe CI check for typecheck/lint/build and a separate controlled SQL-test job design.

### Session 2 — Grade 9–12 shell and navigation

- Verify home, desktop sidebar, compact desktop rail, top bar, mobile navigation, safe-area spacing, back behavior, logout, route titles, and theme variants.
- Remove duplicate/competing navigation only after confirming every destination remains reachable.
- Fix any confirmed horizontal overflow, focus-obscured controls, missing labels, or dead actions.

### Session 3 — academic learning loop

- Verify `/academic`, setup, topics, flashcards, exam, entrance papers, planner, and insights with a real upper-tier student.
- Trace the loop: select curriculum/book → study/practice → submit → feedback → revision/progress.
- Verify verified/past-paper provenance labels are not confused with generated practice.
- Fix loading, empty, retry, and backend-confirmed mutation states.

### Session 4 — study, quiz, library, and AI

- Verify study mode, quiz/filter, revision, library, AI Tutor, and Learning DNA.
- Confirm AI errors, rate limits, missing provider configuration, and insufficient data are presented honestly.
- Check that all durable progress is sourced from Supabase and that browser caches are only optimization/local preference.

### Session 5 — collaboration and profile

- Verify multiplayer, lobby, leaderboard, tournaments, social/community, friends, chat, store, profile, avatar creator, settings, enhanced settings, and notifications.
- Test invitation, acceptance, realtime reconnect, push preference, wallet/reward confirmation, and profile ownership paths.
- Preserve age/tier restrictions and do not route early learners into unrestricted social destinations.

### Session 6 — backend and release hardening

- Decide and implement the account-deletion/request behavior.
- Replace the highest-risk client-side N+1 admin/user queries with paginated RPC-backed reads where needed.
- Confirm production migration workflow safety before any new migration.
- Run the complete release matrix: Node 24 install, typecheck, lint, build, Vercel smoke test, Supabase function deployment validation, Android debug/AAB build, and Windows packaging.

## Definition of done for this phase

The Grade 9–12 phase is complete when the feature branch is the canonical reviewed implementation, the install/build path is reproducible, every planned route has authenticated evidence for its primary journey and state handling, no redesign control is dead or fabricated, role/tier/RLS boundaries are verified for affected flows, and the known account deletion/deployment/environment issues are either fixed or explicitly documented as product decisions.

No database reset, blind migration push, force-push, or claim of full end-to-end completion should occur without the corresponding evidence.
