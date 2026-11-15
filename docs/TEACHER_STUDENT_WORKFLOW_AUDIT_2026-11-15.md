# Teacher and Student Workflow Audit — 2026-11-15

## Scope

Audited the merged `main` branch after PR #507 (`32c1db0`) across student dashboard entry/assignments, teacher class management, quiz authoring, assignment delivery, results, announcements, and the deployed Supabase policies/RPCs.

Static source review was combined with live inspection of project `mytbjkchvfybhyqcynnl`. No authenticated browser session was available, so runtime/mobile observations remain staging checks.

## Confirmed release-blocking findings

### 1. Teacher result privacy is too broad — P1

The live `quiz_results` policy `student views own results` permits any caller with the teacher role to select every result:

```sql
(student_id = auth.uid())
OR has_role(auth.uid(), 'admin')
OR has_role(auth.uid(), 'manager')
OR has_role(auth.uid(), 'teacher')
```

Evidence: live `pg_policies`; source baseline `supabase/migrations/20251211225015_9c53a876-9360-4f7b-a1bb-9404da16d99c.sql:194-203`. `TeacherPortal.tsx:243-269` narrows the normal UI to quizzes created by the current teacher, but RLS must protect direct API access too. A teacher can query results for unrelated teachers/classes.

**Fix:** permit a teacher to read a result only when the teacher owns the quiz or teaches the student's assigned class for that quiz; keep admin/manager access explicit and tested.

### 2. Class discovery and membership are not controlled — P1

Live policies include `authenticated can view classes` with `USING (true)` and `student can join class` with `WITH CHECK (student_id = auth.uid())`. This means an authenticated student can enumerate class IDs and insert their own membership into arbitrary classes without a class-code verification or teacher approval. The repository has no student-facing class-code join flow; teachers only display the code in `TeacherPortal.tsx:1359-1361,1388-1391`.

Source history contains the same risk in broader form: `20251211225015...sql:147-153,156-164`, while `20260104145054...sql:60-75` narrows some policies but does not provide a secure code-claim contract.

**Fix:** remove direct student membership INSERT; implement a server-authoritative `join_class_by_code` RPC with normalized code, expiration/revocation, duplicate handling, grade/tier checks, and audit fields. Add the student UI and tests.

### 3. Targeted announcements are readable by everyone — P1

Live policy `authenticated can view announcements` has `USING (true)`. The teacher UI creates class/student-targeted announcements in `TeacherPortal.tsx:558-652`, but direct reads are not limited to the target audience. This can expose teacher-to-class messages and student-targeted content across accounts.

**Fix:** replace the broad policy with target-aware visibility: author/admin/manager; all; role-targeted; the specified user; or membership in the specified class. Test teacher A/class A versus teacher B/class B.

### 4. Question answer keys are exposed through teacher/student reads — P1

Live policy `view questions of visible quiz` allows any teacher to read question rows for visible quizzes. The question rows contain `correct_answer`; the ordinary student quiz/exam clients also select answer-bearing rows in source. Evidence: live `pg_policies`; `TeacherPortal.tsx:385-398`; `src/context/QuizContext.tsx:82-138`; `src/pages/ExamModePage.tsx:147-152,389-416`.

**Fix:** create safe student question/session DTOs or a server-side session RPC that never returns `correct_answer`; retain answer-bearing access only for the quiz creator/moderator path.

## Confirmed student/teacher workflow defects

### 5. Assignments do not open the assigned quiz — P2

`StudentDashboard.tsx:109-124` loads assignments, but `:381-388` routes every assignment to `/quiz?subject=<subject>` rather than passing `quiz_id` or `assignment_id`. The student can open a different quiz, and completion cannot be reliably attributed to the assignment. Teacher progress at `TeacherPortal.tsx:1426-1433` estimates completion by matching quiz ID and class membership, not assignment identity or assignment creation time.

**Fix:** add a secure assignment-start route/session keyed by assignment ID, enforce student/class membership server-side, and calculate completion from that assignment/session.

### 6. Assignment creation does not validate class/quiz compatibility — P2

`TeacherPortal.tsx:654-691` inserts an assignment after checking only that quiz and class are selected. The UI permits Grade 12 quizzes to be sent to Grade 4 classes and does not validate teacher ownership of the selected class/quiz beyond the database policy. Add a server-side assignment RPC or `WITH CHECK` contract requiring teacher-owned class, permitted quiz, compatible grade, and idempotency.

### 7. Student class joining is incomplete — P2

There is no student UI or route for entering the class code displayed by teachers. The student dashboard only reads existing `class_students` memberships. A teacher can share a code, but the student cannot use it in the current product flow.

### 8. Student dashboard silently degrades — P2

`StudentDashboard.tsx:92-107` runs five independent loads and only logs aggregate failures. `fetchAssignedLearning`, `fetchTodayStats`, `fetchStreak`, and `fetchOnlineFriends` mostly return empty/default state on errors. There is no page-level error/retry state, so an authorization/network failure looks like no assignments, zero streak, or no friends.

### 9. Teacher portal silently degrades — P2

`TeacherPortal.tsx:153-166` starts six loads but has no page-level loading/error model. Several fetchers toast or log and leave empty arrays (`:168-302`, `:304-348`). The dashboard renders empty classes/quizzes/results as successful empty states. `fetchAllStudents` uses one RPC per class (`:205-231`), so one failure silently removes that class from the directory.

### 10. Teacher class cards and destructive controls lack complete semantics — P2

Class cards are clickable `Card` elements without keyboard handlers or semantic button/link behavior (`TeacherPortal.tsx:1240-1249`). Icon-only settings/logout/delete controls lack accessible names in several places. Student removal and quiz deletion have no confirmation/undo.

## Performance risks

- Teacher class directory calls `get_class_students` once per class (`TeacherPortal.tsx:205-231`), then merges client-side.
- Teacher results fetches up to 100 rows but first performs a separate quiz lookup (`:243-269`); an RPC/view could scope and aggregate server-side.
- Student dashboard performs five concurrent data loads and assignment membership plus assignment queries (`StudentDashboard.tsx:92-124`) on every user change.
- `select('*')` is used for teacher quizzes/classes/questions and broad result payloads.
- Live Supabase advisors previously reported 52 unindexed foreign keys and 141 auth-RLS initplan findings; map these against classes, class_students, quiz_assignments, quiz_results, profiles, and announcement policies before release.

## Recommended remediation order

1. Fix live-equivalent RLS and add SQL regression tests for result privacy, class visibility/joining, announcements, and question DTOs.
2. Implement `join_class_by_code` and the student join UI.
3. Implement assignment-specific secure start/completion and grade/ownership validation.
4. Add page-level loading/error/retry states to both student and teacher portals.
5. Replace class/result fan-out with scoped RPCs/aggregates and add indexes after query-plan measurement.
6. Add authenticated browser tests for two teachers, two classes, two students, cross-class access, code joining, assignment completion, and failure/retry behavior.

## Staging matrix

- Teacher A must not read Teacher B's class students, results, quizzes, or targeted announcements.
- Student A must not enumerate or join Student/Teacher B's class by ID; valid code claim must be one-time/idempotent and auditable.
- Students must receive no `correct_answer` in quiz/exam setup responses.
- Assigned quiz launch must open the correct quiz/session and record completion against the assignment.
- Grade-incompatible assignment must be rejected server-side.
- Denied class/result/announcement requests must show retryable errors, not empty success states.
- Test refresh, logout/account switching, mobile keyboard navigation, and screen-reader labels.
