# Teacher PR Review — 2026-11-16

## PRs reviewed

- **#538 — Teacher progress and evaluation visibility**: open, school teacher portal only. Reused the approved-mark average and teacher evaluation panel ideas, but made the evaluation request optional so a missing/unavailable evaluation table cannot blank the entire teacher portal. Progress calculations are memoized instead of filtering all marks and submissions repeatedly during render.
- **#531 — Teacher communication and homeroom review**: merged. Confirmed the useful teacher-parent messaging, behavior review, attendance hardening, homework submission lock, and admin feedback workflows are already on `main`.
- **#536 — Complete teacher portal workflows**: merged. Confirmed the legacy Teacher Portal now includes class lifecycle actions, assignment validation, result filtering/export, and retryable loading.
- **#509 — Teacher/student workflow boundaries**: merged. Confirmed the underlying teacher/class/result/announcement security hardening is already represented in the repository, but still requires Supabase deployment verification.
- **#387 and #442**: merged. Confirmed the student directory, assignment workspace, progress insights, and startup error handling are already incorporated into current main.
- **#525 and #528**: closed/superseded by the consolidated school-management portal work; no changes were copied directly.

## Changes implemented

### School Teacher Portal

- Added teacher-scoped performance evaluation loading from `school_staff_evaluations`.
- Added approved-mark counts and normalized average percentages per assigned student.
- Added a “My performance evaluations” panel with rating, period, type, and notes.
- Made the evaluation query optional: core teacher records still load when evaluations fail.
- Added a retryable error banner for core school-record load failures.
- Memoized progress-row calculations to avoid repeated per-student filtering during render.

### Existing baseline blocker

- Fixed `AcademicInsightsPage.tsx` calling `get_user_stats` with `_user_id` while the generated Supabase contract requires `p_user_id`. This was unrelated to the teacher PR work but prevented repository typecheck from passing.

## Validation

- `npm run typecheck` passed.
- `npm run build` passed.
- `git diff --check` passed.

## Remaining follow-up

The teacher PR review did not automatically merge PR #538 because its direct implementation had no optional-load handling and no memoized progress derivation. This branch contains the corrected implementation instead.
