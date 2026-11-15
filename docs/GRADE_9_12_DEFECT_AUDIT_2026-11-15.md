# Master Minds Grade 9–12 defect audit

**Audited code:** `main` at `8992286` / build tag `build-875`  
**Context branch:** `feat/figma-upper-tier-ui` at `9ae8b4d`  
**Audit date:** 2026-11-15  
**Static baseline:** `npm run typecheck` and `npm run build` pass; no authenticated browser session or production database access was used.

## Severity meaning

- **P1 — release risk:** security, learning-integrity, data-integrity, or a core Grade 9–12 journey can be wrong or unusable.
- **P2 — important:** significant feature, persistence, authorization, or performance defect that should be fixed during completion.
- **P3 — polish/accessibility:** real quality problem, but not normally a release blocker by itself.
- **Verify:** source evidence is strong, but deployed schema, authenticated behavior, or device testing is needed before final severity is assigned.

## P1 release risks

### 1. Past-paper answer keys are sent to the student browser

`/academic/entrance-papers` requests all approved Grade 12 questions including `options` and `correct_answer`, although the page only needs subject availability. Evidence: `src/pages/EntranceExamPapersPage.tsx:66-103`.

This allows a learner to inspect answer keys before starting an exam and also creates a large unnecessary payload. Replace this with a server-side subject/count aggregate or a query that never returns answer-bearing fields. The exam session should receive questions through an authorized server flow only.

### 2. Quiz subsets are scored against the full source quiz

The UI can show a 10-question practice subset from a 50-question source quiz: `src/pages/Quiz.tsx:135-160` and `src/components/quiz/QuizView.tsx:210-229`. The current secure RPC loops/counts all questions in the source quiz: `supabase/migrations/20261114160000_harden_multiplayer_room_integrity.sql` / the final quiz reward hardening migration, around the `submit_quiz_result_secure` implementation.

The omitted 40 questions can be treated as wrong, corrupting accuracy, score, XP, and feedback. The server contract must accept the exact displayed question IDs and score only that session set.

### 3. Failed quiz saves still become local “completed” work

`saveQuizResults` can return `false`, but the completion flow continues: `src/components/quiz/QuizView.tsx:215-220,259-263,282-289`. `src/pages/Quiz.tsx:343-358` then records the quiz/source ID in local storage and the completed set.

A learner can see a successful completion even though the authoritative result did not persist. Completion, local history, and success messaging must happen only after a successful server response. Failed saves need retry and an explicit unsaved state.

### 4. Study Mode rewards too much for short sessions

The client allows manual completion after about 60 seconds: `src/pages/StudyModePage.tsx:415-419`. The server RPC clamps the duration to at least five minutes and awards XP/coins from that value: `supabase/migrations/20261018130000_complete_study_mode_reliability.sql:197-215`.

A five-minute session can therefore produce five minutes of rewards after roughly one minute. The server must reward only validated elapsed time, with any minimum-session policy explicitly aligned to actual time earned.

### 5. Multiplayer room-code and random-match flows use a removed column

`src/pages/Lobby.tsx:718-723,753-759` queries `multiplayer_rooms.password`. The hardening migration removes that column and replaces password handling with `has_password` and RPC validation: `supabase/migrations/20261114120000_harden_multiplayer_room_integrity.sql:297-299`.

Room-code joining and random matchmaking can fail before the hardened join path is reached. Consolidate both flows on `multiplayer_join_room` and the current room metadata contract.

### 6. Tournament registration uses incompatible models

`Lobby.tsx` reads/inserts `tournament_participants`, while `TournamentHub.tsx` and the canonical workflow use `tournament_players` and `join_tournament`.

Evidence:

- `src/pages/Lobby.tsx:279-330,477-505,818-847`
- `src/components/tournaments/TournamentHub.tsx:155-163,204-223,326-346`
- `supabase/migrations/20260418153000_master_minds_tournament_full_workflow.sql:236-313`

Students registered through one surface may disappear from brackets/counts or bypass deadline, fee, capacity, autostart, and bracket rules. There must be one canonical registration and lifecycle workflow.

### 7. Profile privacy switches do not hide private profile data

`UserProfilePage` reads `is_public`/`hide_stats` and shows controls, but still renders stats, activity, achievements, collections, and learning progress. Evidence: `src/pages/UserProfilePage.tsx:343-436,878-1005,1026-1041`.

The privacy settings are also publicly readable through the policy in `supabase/migrations/20260410143000_competitive_social_leaderboard.sql:69-71`. Enforce visibility in the server query/RPC and conditionally suppress every private section in the UI.

### 8. Profile challenge invite RPC is out of sync

The profile page calls `create_multiplayer_invite` with five named parameters: `src/pages/UserProfilePage.tsx:647-655`. The migration defines a two-parameter function: `supabase/migrations/20261006060000_multiplayer_invites_results_settings.sql:5-50`.

The preceding follow-challenge insert may succeed before the invite call fails, creating an orphaned pending challenge. Align migrations, generated Supabase types, and the client, then make the operation transactional/idempotent.

### 9. Academic setup has an inconsistent tier guard

`/academic/setup` uses generic `ProtectedRoute`, while `/academic` and the academic child routes use `EarlyTierRestrictedRoute`: `src/App.tsx:372-380`.

An early or middle student can directly open setup and save an upper academic profile, then be blocked from the upper journey afterward. Apply one authoritative tier/grade guard and validate profile transitions on the server.

### 10. Library moderation permissions disagree with the UI

Teachers see Approve/Reject/Edit/Delete controls, but database policies grant all-book moderation only to admin/manager. Evidence: `src/pages/LibraryPage.tsx:298-302,826-849` and `supabase/migrations/20260408100000_add_library_feature.sql:44-62`.

Teacher actions can fail while the UI presents them as available. Either restrict the UI to actual permissions or add a server-authoritative moderator RPC with explicit role validation and proper error handling.

### 11. Unmoderated library files are publicly readable

Library PDFs/thumbnails use public buckets and public SELECT policies while student uploads remain pending. Evidence: `supabase/migrations/20260408100000_add_library_feature.sql:95-107`, `supabase/migrations/20260410204500_enforce_student_library_moderation_flow.sql:5-24`, and `src/lib/libraryApi.ts:520-531`.

Anyone who obtains an object URL may read material before approval. Use private storage, signed URLs, and server-side moderation checks.

### 12. Parent dashboard does not actually switch to the linked child

`ParentDashboard` loads linked children, but its core reads and mutations continue using `user.id`: `src/pages/ParentDashboard.tsx:78-90,132-155,229-270`.

Parent mode may therefore show or mutate the parent’s own data rather than the selected child’s data. Add explicit selected-child state and server-side authorization for every child-scoped query and mutation.

### 13. Chat attachments are only filename messages

The file handler inserts a text message containing `📎 ${file.name}` and does not upload or persist a file: `src/pages/Chat.tsx:793-802`.

This is misleading to learners. Implement controlled storage upload, attachment metadata, recipient rendering/download, and failure handling—or remove the attachment affordance until implemented.

## P2 important defects

### Learning integrity and persistence

- Regular `/quiz` and `/quiz/filter` are not tier-gated. Early learners can enter the middle/default quiz path and select out-of-tier grades. Evidence: `src/App.tsx:294,304`, `src/pages/Quiz.tsx:34-37`, `src/pages/QuizFilter.tsx:25-39`.
- The quiz submission RPC does not enforce approved quiz status, grade/tier eligibility, or caller role. The UI filter is not enough; enforce it inside the security-definer RPC.
- Revision advances and displays feedback even when the `revision_schedule` write fails: `src/pages/TimeTravelRevision.tsx:158-188`.
- Revision silently limits incorrect attempts to the newest 100: `src/pages/TimeTravelRevision.tsx:64-82,119-131`.
- “Practice now” from Topic Coverage sends a blank topic parameter: `src/pages/TopicCoveragePage.tsx:124,158-160`.
- Academic goal labels omit `entrance_exam`, `exit_exam`, `mock_exam`, and `past_papers`: `src/pages/AcademicMode.tsx:22-28,92-93`.
- Study planner can generate up to 365 days but reads only 90 days: `src/pages/StudyPlannerPage.tsx:54-63,266-318`.
- Academic Insights has incompatible historical `get_user_stats` return definitions (table versus jsonb). Reconcile the deployed migration state and client contract before relying on its metrics.

### Settings, profile, and stale data

- Most Settings switches are local/default values and are not persisted: `src/pages/Settings.tsx:273-372`.
- Enhanced Settings persists only a narrow MindForge settings subset; many displayed controls have no persistence path: `src/pages/EnhancedSettings.tsx:72-78,335-535`.
- Delete-account actions are inert or only show a support toast. The app does not delete accounts.
- Profile About “auto-save” writes only `localStorage`: `src/pages/UserProfilePage.tsx:590-602,1008-1022`.
- Learning DNA can show stale data after account switching because in-flight loads are not cancelled/invalidated: `src/hooks/useLearningDNA.ts:150-199`.
- Profile realtime subscriptions are table-wide and trigger expensive refreshes for unrelated users: `src/pages/UserProfilePage.tsx:512-525`.

### Social and collaboration

- Social likes, reactions, saves, follows, and comments do not inspect returned Supabase errors: `src/components/social/SocialFeedView.tsx:232-309,359-375`.
- Chat group creation does not check creator-membership insertion before showing success: `src/pages/Chat.tsx:349-357`.
- Chat reaction buttons open reply mode instead of persisting reactions: `src/pages/Chat.tsx:676-684`.
- Social share URLs target `/social#post-id`, but the destination does not read the hash or open the post: `src/components/social/SocialFeedView.tsx:311-318`.
- Staff roles are admitted to student social/chat routes through `EarlyTierRestrictedRoute`; confirm whether this is intended policy.

### Privacy and data exposure

- Study Mode reads all `study_participants` without competition/user scope: `src/pages/StudyModePage.tsx:170-175`; the related policy uses broad authenticated SELECT access.
- Entrance Papers also fetches all approved questions across grades before filtering in JavaScript, increasing both exposure and payload size.
- Library reading progress and generated-question saves update optimistically while swallowing persistence errors: `src/pages/LibraryPage.tsx:379-395,467-476`.

## P3 accessibility and polish defects

- Academic Insights fallback renders Markdown-like bullets/emphasis as literal text: `src/pages/AcademicInsightsPage.tsx:132-164,250-252`.
- Academic setup exposes only the first 100 books without search/pagination: `src/pages/AcademicSetup.tsx:111-117`.
- Planner icon-only task/delete buttons lack accessible names: `src/pages/StudyPlannerPage.tsx:641-647,659-661`.
- Friends/chat/social icon controls lack accessible labels in multiple places: `src/pages/Friends.tsx:512-514`, `src/pages/Chat.tsx:768`.
- Social images use generic `alt="Post"`: `src/components/social/SocialFeedView.tsx:486-493`.
- Quiz multiple-choice cards pad options with blank strings: `src/components/quiz/QuestionCard.tsx:19-22`.
- AI Tutor speech recognition and synthesis lack unmount cancellation: `src/pages/AITutor.tsx:73-90`.
- The upper-tier app may mount both `AppChrome` and `UpperTierStudioShell` navigation structures: `src/App.tsx:176-210`, `src/components/layout/UpperTierStudioShell.tsx:53-62`. Verify desktop/tablet rendering for duplicate sidebars or headers.
- Student Dashboard has loading loaders but does not use loading state in rendering, which can show transient zero/empty content: `src/pages/StudentDashboard.tsx:74-107`.

## Main lag and performance sources

### 1. Study Mode realtime query storm

`src/pages/StudyModePage.tsx:170-177,229-235,262-270,306-316` subscribes to six broad tables and runs about seven queries plus participant-name lookup on every event. The 30-second heartbeat can cause recurring reloads. Scope subscriptions, debounce/in-flight guard reloads, cancel stale requests, and update only affected records.

### 2. Global quiz-bank loading

`src/context/QuizContext.tsx:83-108,385-402` loads every approved quiz and every related question with `select(*)`, then refetches the full bank on quiz events. The provider is mounted globally in `src/App.tsx:265-274`, so unrelated routes pay this cost. Load quiz data only on quiz routes, use narrow projections/server-side session generation, and debounce invalidation.

### 3. Profile hydration and realtime fan-out

Profile hydration combines leaderboard fallback aggregation, approximately ten detail queries, unbounded store/catalog reads, and table-wide realtime refreshes: `src/pages/UserProfilePage.tsx:309-346,439-443,502-520`, `src/lib/leaderboardApi.ts:103-117`. Use a bounded server profile DTO and row-filtered subscriptions.

### 4. Whole quiz/question-bank reads in Exam Mode and Entrance Papers

`src/pages/ExamModePage.tsx:130-151,389-416` and `src/pages/EntranceExamPapersPage.tsx:66-105` fetch large banks and filter/shuffle in the browser. Use server-side subject/session selection and never return answer keys to catalog pages.

### 5. Planner PDF processing

The planner can select up to 500 books and sequentially download/parse up to 120 pages per PDF: `src/pages/StudyPlannerPage.tsx:83-89,174-224,532`. Add total byte/page/book caps, progress, cancellation, and preferably background/server processing.

### 6. Library, friends, chat, social, and parent N+1 work

- Library loads all books/progress/highlights/generated questions and client-paginates afterward: `src/lib/libraryApi.ts:168-200,443-487`.
- Friends loads unbounded direct-message history and refreshes the full payload on presence events: `src/context/FriendsContext.tsx:204-220,242-245,299-306`.
- Chat performs serial per-room last-message/member queries: `src/pages/Chat.tsx:117-170`.
- Social performs up to 50 per-post comment-count queries: `src/components/social/SocialFeedView.tsx:112-143`.
- Parent Dashboard reloads many datasets for each realtime event and has unbounded tasks: `src/pages/ParentDashboard.tsx:82-120,156-166`.

### 7. Large bundles

The build produces large minified chunks, including Study Mode around 642 kB and the main index around 936 kB. Split heavy PDF, AI, chart, and feature dependencies further after correctness fixes are complete.

## Required verification before calling Grade 9–12 complete

1. Confirm live Supabase migration order/schema cache for quiz submission, multiplayer rooms, tournament tables, library RLS/storage, profile hardening, study-mode RPCs, academic goals, and `create_multiplayer_invite`.
2. Test early/middle/upper student accounts plus teacher/admin/manager accounts through academic setup, quizzes, study mode, social/chat, multiplayer, library, parent dashboard, profile privacy, and settings.
3. Submit a small practice subset from a larger source quiz and compare displayed questions/results against persisted totals, XP, completion, and reward eligibility.
4. Force quiz, revision, social, chat, library, and profile mutation failures and verify no false success or false completion is shown.
5. Test room-code/random match, tournament registration/brackets/deadlines/fees/autostart, realtime reconnect, and mobile controls.
6. Test student library upload and direct file URLs before moderation; verify teacher/admin/manager moderation behavior.
7. Test a parent with multiple linked children and verify every read/mutation follows the selected child.
8. Switch between two authenticated accounts without a full reload and check for stale profile/Learning DNA data.
9. Measure large-dataset payloads, query counts, long tasks, memory, realtime event amplification, and mobile cold-load time.
10. Run mobile/accessibility checks for focus, labels, speech cleanup, notification persistence, PDF cancellation, and duplicate upper-tier shell rendering.

## Recommended fix order

1. Remove answer-key exposure and fix quiz scoring/completion integrity.
2. Fix multiplayer room and tournament contract drift.
3. Fix study reward validation and profile privacy.
4. Fix academic setup tier isolation and entrance-paper filtering.
5. Fix library moderation/storage privacy and parent child selection.
6. Add error handling to all social/chat/library/revision mutations.
7. Reduce global/realtime/unbounded query work.
8. Finish accessibility, settings persistence, account deletion behavior, and visual polish.
