# School Manager experience upgrade — audit baseline

This document records the scope and validation boundaries for the Manager experience refresh. It is an implementation and test inventory, not a claim that every production workflow has been manually accepted.

## Navigation and route inventory

The Manager sidebar is grouped into six areas. Each visible destination has one navigation ID and one route in `SchoolManagerPortal.tsx`.

| Group | Destination | Route | Existing workflow |
|---|---|---|---|
| Command center | Overview | `overview` (default) | Live enrollment/staff summary, follow-up queue, school setup checklist, shortcuts |
| People & school | Student Directory | `students` | Search, lifecycle, placement, unified student profile |
| People & school | People & Accounts | `accounts` | School account provisioning and account linking |
| People & school | Staff Directory | `staff` | Searchable school staff directory |
| People & school | Teacher Assignments | `assignments` | Section and subject assignments |
| People & school | Leadership Team | `leadership` | Appointments, division mappings, teams, permissions and audit |
| Academic management | School Structure | `structure` | Academic years, terms, sections, subjects |
| Academic management | Academic Management | `academics` | Assessment, marks, results, homework and learning oversight |
| Academic management | Curriculum & Support | `curriculum` | Curriculum units, teaching progress and support plans |
| Academic management | Grading & Policies | `grading` | Grading policy, categories, scales and rank scope |
| Daily operations | Attendance | `attendance` | Attendance session and exception oversight |
| Daily operations | Timetable & Calendar | `timetable` | Weekly timetable and school calendar |
| Daily operations | Parent Communication | `communications` | Announcements, parent notifications, link coverage and messaging metadata |
| Daily operations | Staff & Student Support | `staff-support` | Staff tasks, accountability and student support |
| Daily operations | Content Governance | `content-governance` | School content review oversight and review history |
| Finance & insights | Fees & Finance | `finance` | Fee structures, invoices, payments and follow-ups |
| Finance & insights | Reports & Analytics | `reports` | Enrollment/staff charts, currency-separated balances and drill-down |
| Administration | School Audit | `audit` | Enrollment, structure and leadership history |
| Administration | Manager Settings | `settings` | School policy settings; network-managed identity stays read-only |

Legacy renderer functions for tasks, evaluations, requests and discipline remain in the page source while their capabilities are surfaced through the consolidated Staff & Student Support workspace. They are not separate sidebar destinations. Their unique actions must be reconciled before any legacy implementation is removed.

## Student profile data contract

The profile is a read-only aggregation of school-scoped records, all filtered by both `school_id` and the selected student membership ID:

- Membership/profile identity and assigned school student number.
- Published `school_term_results`; academic rank is displayed only when `published_at` and `rank_position` exist.
- `school_student_marks` joined to school assessment metadata.
- `school_attendance_records` and matching session dates.
- `school_homework_submissions` status, recorded grade and feedback; submission text and attachment paths are not exposed.
- `school_student_invoices` with balances grouped by original currency.
- `school_record_events` enrollment and placement history.

No rank is inferred from XP, a profile-wide rank field, or unpublished term results. Missing records are displayed as empty states, not as zero scores or failures.

## Validation coverage

- Existing signed-in portal E2E scenarios cover the Manager Part 1, academic oversight, curriculum, attendance, timetable/calendar, parent communications, staff/student support, and content governance workspaces.
- This change adds desktop, tablet and mobile E2E coverage for the command center, grouped navigation, report drill-down entry points, searching the CI student fixture, and opening/closing the student profile.
- A contract script verifies unique visible navigation IDs, route coverage, school-scoped student queries, published-rank gating, and the absence of private homework response/attachment fields from the profile summary.
- No production schema migration, production data write, or manual deployment is part of this change.

## Acceptance still required

CI and the isolated local Supabase fixtures cannot prove every production Manager permission and data state. Final acceptance still needs separate Manager, appointed-leader, teacher and student sessions; real populated records; denied unauthorized writes; and responsive manual checks. Empty production data must remain an honest empty state.
