# Super Admin / Network Super Admin workflows

This document defines the network-level responsibilities and authority boundaries for the active portal at `/super-admin`, implemented by `src/pages/NetworkSuperAdminPortal.tsx`.

The active portal is `NetworkSuperAdminPortal.tsx`. The older `src/pages/SuperAdminPortal.tsx` is a legacy component and is not the current network portal.

## Authority model

- The Super Admin controls the assigned school network, not the whole Master Minds platform.
- Network reads and mutations must be restricted to `school_network_id()`.
- The Super Admin is allowed to register schools, provision School Managers, manage permitted school membership states, and view network-level reporting.
- Extreme Admin retains platform-wide account, security, infrastructure, and cross-network authority.
- School Managers and school-specific portals retain day-to-day teaching, enrollment, academic, and school finance workflows.
- Global account status and school membership status are separate concepts. A network membership action must not silently change a global account state.

## 1. Network overview

The Overview workflow provides:
- Total, active, suspended, and closed school counts.
- Active Manager, legacy Admin, Teacher, Finance, Parent, and Student membership counts.
- Schools without an active Manager.
- Network alerts for suspended schools, missing Managers, pending finance follow-ups, and pending behavior reports.
- A searchable school directory with direct access to school analytics and status actions.

Counts are membership counts, not deduplicated people counts. Alert details are school-level aggregates and must not expose student names or private report narratives.

## 2. School lifecycle

| Current state | Available action | Result |
| --- | --- | --- |
| Active | Suspend | Suspended |
| Active | Close | Closed |
| Suspended | Restore | Active |
| Suspended | Close | Closed |
| Closed | Reopen | Active |

Every transition requires a reason of at least eight characters and creates an audit event. School records are never deleted by this workflow. Every status mutation must verify the school belongs to the current network.

## 3. School registration and Manager onboarding

### Register a school
1. Enter the registered school name and unique school code.
2. Enter the initial Manager's full name.
3. Call the secured `school-provision-account` Edge Function with `create_school`.
4. Create the school inside the network and provision the initial Manager.
5. Display the one-time Manager credentials, allow copying, and warn the operator to share them securely.
6. Refresh the school directory and audit history.

### Provision a Manager for an existing school
1. Select an active school.
2. Enter the Manager's full name.
3. Call `school-provision-account` with `create_accounts` and role `manager`.
4. Display and allow copying of the one-time credentials.
5. Surface any audit warning and refresh the directory.

Super Admin may provision School Managers only. Other school account creation remains within school-owned workflows.

## 4. Assign an existing account

The Super Admin can attach an existing active account to an active school as:
- School Manager
- Finance
- Parent

The workflow requires:
- A school in the Super Admin's network.
- An exact existing username and active account.
- A reason of at least eight characters.
- A role consistent with the account's existing global school role and active school memberships.
- For Parent assignment, one or more active student usernames already enrolled in the selected school.

The backend validates all conditions again, creates the membership, links Parent to the selected student memberships when applicable, and writes an audit event. Platform authority accounts and conflicting roles are rejected. The Extreme Admin path remains separate and retains its global provisioning authority.

## 5. People and membership administration

The People directory supports:
- Search by person, username, or school.
- Filter by school and role.
- Paginated network membership results.
- Separate display of global account status and school membership status.

Permitted network membership transitions:

| Membership role | Current state | Available action | Result |
| --- | --- | --- | --- |
| Manager, Teacher, Finance | Active | Suspend / Deactivate | Suspended / Deactivated |
| Manager, Teacher, Finance | Suspended | Restore / Deactivate | Active / Deactivated |
| Manager, Teacher, Finance | Deactivated | Reactivate | Active |
| Parent, Student | Active | Suspend access | Suspended |
| Parent, Student | Suspended | Restore access | Active |

Every change requires a reason and creates an audit event. Parent and Student network actions are limited to temporary access suspension/restoration. Student transfer, graduation, deactivation, and parent-child enrollment changes remain school-owned workflows. A Parent or Student membership already transferred, graduated, or deactivated cannot be reactivated from the network portal.

Legacy School Admin memberships are retired in the current school model. They remain visible for audit/context but are read-only; leadership changes use the School Manager and leadership appointment workflow.

The Super Admin does not globally ban, delete, or change the platform account status from this directory.

## 6. School analytics

For a selected school, Analytics shows aggregated operational and academic indicators supplied by the school analytics RPC, including:
- Student, Teacher, Manager, legacy Admin, Finance, and Parent membership counts.
- Average term score and attendance rate when available.
- Attendance records and published results.
- Pending behavior report count.
- Invoice and confirmed invoice-linked payment counts.
- Outstanding balances grouped by currency.

This is network oversight, not a student-level academic record browser. Missing data is shown as an empty state, not fabricated sample data.

## 7. Network finance oversight

Finance is read-only and includes:
- Invoice and confirmed payment counts.
- Pending follow-up count and overdue positive-balance invoice count.
- Invoiced, confirmed-paid, and outstanding totals grouped by currency.
- Overdue balances grouped by currency.
- Recent invoice records, recent invoice-linked payments, and pending follow-up records.
- CSV export of the recent finance records returned by the reporting RPC.

A payment counts as confirmed only when it is linked to an invoice and has confirmed status. No values from different currencies are added together. The Super Admin does not create invoices, confirm or reverse payments, edit payment methods, or resolve school Finance follow-ups.

## 8. Audit history

Audit history supports:
- Network-scoped audit events.
- Pagination.
- Local filtering of the visible page by actor, action, target, or metadata.
- CSV export of the visible page.

School status, membership status, existing-account assignment, school registration, and network-name changes must be auditable. Status changes and existing-account assignments must include the operator's reason in audit metadata.

## 9. Network settings

The current editable network setting is the singleton network display name. Saving it requires a valid 2–160 character name and creates an audit event. Other settings must not be invented as visual-only controls; add them only when there is a real backend contract and clear ownership.

## 10. Explicitly out of scope for this portal

These workflows remain with the named owner:
- Platform-wide accounts, global security, infrastructure health, and cross-network controls — Extreme Admin.
- Daily attendance entry, class/section setup, academic calendars, student enrollment, student transfers/graduation, teacher assignments, assessment entry, and academic operations — school portals, primarily School Manager.
- Invoice creation, payment confirmation/reversal, receipt corrections, and finance follow-up resolution — School Finance.
- Routine parent/student profile and academic record editing — the relevant school portal.

## Security and implementation invariants

- Never trust a school ID supplied by the browser without checking its network ownership server-side.
- Never use service-role-only RPCs directly from an untrusted client.
- The Super Admin membership assignment RPC must enforce Super Admin identity, network scope, active account status, school-role consistency, parent-child link validity, and audit logging.
- Parent/Student access holds must never be used as a substitute for transfer, graduation, or deactivation workflows.
- The reason-free two-argument school status RPC is not available to authenticated clients; clients must use the reason-required network-scoped overload.
- No demo data, fabricated metrics, or cross-currency totals.
