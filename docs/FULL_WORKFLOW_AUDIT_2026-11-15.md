# Full Workflow Audit — 2026-11-15

## Scope and evidence

This report covers all 12 product workflows using source inspection, repository checks, and the connected Supabase project. It distinguishes confirmed source/live findings from staging-only checks. `npm run typecheck` and `npm run build` passed during the audit; neither proves authenticated runtime behavior.

## Live Supabase facts

The project `master-minds` (`mytbjkchvfybhyqcynnl`) is `ACTIVE_HEALTHY`. Applied migrations were reported through `20261114212725`; `20261115120000_restore_quiz_subset_scoring.sql` and `20261115121000_fix_study_reward_elapsed_time.sql` are not applied. `library-files`, `library-thumbnails`, and `social-images` are public. Supabase advisors report 9 RLS-enabled tables without policies, 129 callable `SECURITY DEFINER` functions granted to `authenticated`, 52 unindexed foreign keys, and 141 auth-RLS initplan findings. These aggregate counts require table/function mapping before assigning workflow-specific exploitability.

## Severity-ranked release blockers

1. **P1 — Authorization fail-open:** `src/context/UserContext.tsx` previously defaulted role RPC errors/null to `student`, potentially admitting users while authorization state was unavailable. This remediation branch changes that to fail closed.
2. **P1 — Parent security boundary missing:** parent mode is browser-local/profile-flag based; linked-child IDs are not used by most reads/mutations; `claim_parent_link_code` is absent from the repository; child tables use child-only policies.
3. **P1 — Unauthorized social access:** direct messages do not require accepted friendship; group self-membership policy permits guessed-ID insertion; public/class discovery conflicts with the SELECT policy.
4. **P1 — Library privacy/moderation:** pending PDFs/thumbnails are publicly readable; owner patches can change moderation status; moderation is split across non-atomic calls.
5. **P1 — Profile privacy:** privacy reads can fail open to public defaults; private profiles still expose hero identity/progression/About; settings/About are largely not persisted.
6. **P1 — Quiz/exam integrity:** clients receive `correct_answer`; `/quiz` and `/quiz/filter` lack the early-tier guard; production still uses whole-source scoring until the subset migration is deployed.
7. **P1 — Tournament integrity:** bracket seeding can silently drop non-power-of-two players and finalization is not idempotent, risking repeated rewards.
8. **P1 — Account lifecycle:** visible Delete Account controls do not delete accounts or data.
9. **P1 — Parent link/data contract:** missing link-code RPC and child-only RLS make true parent access nonfunctional.

## Workflow findings

### 1. Authentication, onboarding, roles, and tier routing

Confirmed: role resolution failed open to student; missing/invalid student grade can bypass onboarding on direct dashboard routes; staff behavior through the shared early-tier wrapper is undefined; parent mode is client-local; account deletion is nonfunctional. Risks: unpaginated privileged user loading plus one role RPC per profile. Required tests: role-RPC failure, null/malformed grade, direct URLs, logout/account switch, and parent identity.

### 2. Grades 9–12 academic preparation

Confirmed: Flashcards, Topic Coverage, and Academic Insights have failure paths that render empty/default content without retry; Topic Coverage can navigate to a blank subject/topic practice URL; goal labels omit upper-prep enum values; flashcard content is broadly loaded and client-filtered; AI insights accept client-held metrics without server recomputation. Risks: `select('*')`, global flashcard realtime reloads, and broad topic/progress reads.

### 3. Quiz, practice, exam, entrance papers, and revision

Confirmed: answer keys are sent to quiz/exam clients; regular quiz routes were not tier-gated; production subset scoring fix is unapplied; revision schedule upsert used a conflict target without a unique index and swallowed errors; failed revision loads looked like an empty queue; blank padded options are focusable. This branch adds the tier wrapper, revision retry UI, error reporting, and uniqueness migration. Required staging test: submit a 10-question subset from a larger quiz and compare persisted totals, attempts, XP, and rewards.

### 4. Study Mode and planner

Confirmed: initial failures render zero/empty state without retry; table-wide realtime events reload seven sources and can race; planner has no realtime refresh; production reward logic floors eligible elapsed time at five minutes while the checked-in fix allows one minute; role policy for non-students is unclear; AI failure falls back without truthful status. Apply and verify `20261115121000_fix_study_reward_elapsed_time.sql` before release.

### 5. Library upload, moderation, reading, storage, and analysis

Confirmed: public buckets expose pending files; owner can submit status changes; teacher UI and effective policy disagree; moderation writes are non-atomic; delete leaves orphaned storage; progress/highlight/generated-question persistence errors are ignored; AI fallback is presented as successful; initial loads are unbounded/client-paginated; no library-specific tests. Required remediation: private buckets, signed URLs, server-authoritative atomic moderation, storage cleanup, and retryable persistence.

### 6. Multiplayer lobby, rooms, invites, gameplay, and results

Confirmed: private-room code lookup cannot discover private rooms under hardened RLS; room creation and settings are split calls; room loads ignore subrequest errors; invite acceptance and membership are split; result metrics include fabricated response time/rank/topic values; icon-only controls lack names. Risks: wildcard realtime and roster refetch storms. Required remediation: join-by-code RPC, transactional creation/invite acceptance, fail-closed loading, authoritative result DTOs, filtered/debounced subscriptions.

### 7. Tournaments

Confirmed: scheduled starts truncate player counts to powers of two and can strand registrants; skip-round can run before completion; finalization/rewards are not idempotent; discovery/details have no loading/retry; data is broadly readable to authenticated users; realtime invalidation refetches whole datasets; cards/bracket/live options are inaccessible and live arena lacks completion interaction. Required remediation: transactional bracket state machine, reward claim idempotency, scoped queries/RLS, retry states, and accessible controls.

### 8. Social feed, friends, direct chat, groups, and notifications

Confirmed: direct messaging lacks friendship authorization; guessed-ID group self-membership is possible under the later policy; public/class discovery conflicts with group SELECT RLS; social images are public; Friends/feed failures look empty; mutations ignore returned Supabase errors; notification preference does not suppress global live social toasts; attachments are filename-only and not uploaded; several icon controls lack labels. Risks: unbounded messages, serial room queries, per-post count fan-out, and global realtime reloads.

### 9. Profiles, privacy, achievements, settings, collection, and deletion

Confirmed: deletion absent; most settings ephemeral; About is localStorage rather than shared profile data; privacy writes ignore errors; privacy data is broadly readable; privacy read errors fail open; private profile hero/About remain visible; achievement client upsert conflicts with hardened read-only grants; profile detail failures render defaults without retry. Risks: broad catalog/collection loads and realtime-triggered refresh fan-out.

### 10. Parent portal

Confirmed: missing `claim_parent_link_code`; no selected-child data boundary; task/message/goal policies authorize only `auth.uid() = student_id`; partial load failures look empty; finance hard-codes ETB and overview does not return currency; metrics use UTC day keys; destructive controls lack confirmation/accessibility labels. Risks: eight-request reload storm on every realtime event and leaderboard fetch up to 500 rows.

### 11. Teacher, admin, manager, content, and moderation

Confirmed: Manager Suspend/Ban only resolves a report and does not change account status; Save Settings logs an announcement rather than persisting settings; AdminPortal and TeacherPortal collapse failures into empty/zero states; manager reports lack reported-object context; teacher library controls do not match policy; pending library files are public. Risks: broad staff reads, unbounded datasets, N+1 class/notification calls, and table-wide realtime.

### 12. Cross-cutting deployment and release controls

Confirmed: CI can run blind `supabase db push` despite migration-history drift documentation; no SQL/RLS/grant release gate is wired to package scripts or deployment. Global providers load large quiz/achievement data on unrelated routes; wide `select('*')`, unbounded histories, N+1 lookups, and table-wide realtime recur across the product. Build warnings include a roughly 935 kB main chunk and other large chunks. Required remediation: controlled migration reconciliation, approval, SQL/pgtap gates, pagination/projections, measured indexes, filtered/debounced realtime, and browser/E2E tests.

## Ordered remediation plan

**PR 1 — Authorization/privacy:** fail-closed role and tier policies; server-authorized parent-child context; direct-message/group authorization; private library storage and moderation; server-enforced profile privacy.

**PR 2 — Integrity/deployment:** deploy and verify subset scoring and elapsed-time fixes; revision uniqueness; idempotent tournament rewards/brackets; transactional multiplayer; migration-history approval and SQL/RLS/grant gates.

**PR 3 — Sensitive-data contracts:** remove answer keys from clients; server-validate tier/ownership/AI/library/social/parent/tournament inputs; implement deletion or remove misleading controls; persist settings/About.

**PR 4 — Reliability UX:** explicit loading/error/empty/retry states; inspect every Supabase result error; request sequencing/cancellation; retry-safe rewards, invites, deletes, moderation, and partial exams.

**PR 5 — Performance:** narrow projections, pagination, server aggregates, filtered/debounced realtime, mapped FK/RLS index fixes, and off-main-thread PDF work.

**PR 6 — Release tests/accessibility:** authenticated browser matrices, SQL/pgtap authorization/idempotency tests, failure injection, realtime reconnect, keyboard/screen-reader/mobile coverage, and reduced-motion support.

No workflow is defect-free based on this audit. A successful build or ACTIVE_HEALTHY status is not authenticated runtime verification.
