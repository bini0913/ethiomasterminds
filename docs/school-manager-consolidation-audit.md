# School Manager portal consolidation audit

## Scope of this branch

This branch establishes `/school/manager` as the canonical School Manager experience without introducing a second role, database, authentication system, or school-management application.

## Findings

- `/school/manager` already owns a school-scoped portal backed by `SchoolPortalProvider`, `SchoolPortalGate`, Supabase school memberships, school academic years, sections, subjects, teacher assignments, fees, invoices, staff workflows, grading configuration, and school review RPCs.
- `/manager` and `/manager-dashboard` were separate legacy experiences. They exposed platform-oriented controls such as tournament operations and general user moderation rather than the school-level workspace described in the product requirements.
- The existing school membership context selects active memberships for the authenticated user and the Manager gate requires an active `manager` membership before rendering the portal.
- Super Admin and Extreme Admin routes remain separate and were not redirected or re-scoped by this branch.

## Changes in this branch

- Manager login and root-role redirects now land at `/school/manager`.
- `/manager` and `/manager-dashboard` remain compatibility URLs for authenticated Managers, but redirect to `/school/manager` instead of rendering duplicate Manager interfaces.
- The compatibility routes no longer grant Admin or Extreme Admin access to the legacy Manager UI.
- Route metadata now names all three Manager URLs as the School Manager portal.
- The school switcher remains membership-based and is available at mobile widths when a Manager has more than one active authorized school membership.

## Not claimed complete

This is a consolidation and foundation slice, not completion of every feature in the supplied school operating-system specification. The current portal still needs an evidence-backed implementation pass for admissions, student directory/profile workflows, attendance, timetable, exams/results, homework oversight, communications, protected audit views, and any missing database/RPC contracts. No new migration was added because this slice reuses existing contracts and does not require a schema change.

## Verification boundary

Source-level validation must be completed with the repository's typecheck, lint, build, and relevant database/security tests. Authenticated Boriyad validation requires a real authorized session and should not be represented as complete from static inspection alone.
