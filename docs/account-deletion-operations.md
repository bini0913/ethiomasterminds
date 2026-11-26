# Master Minds account-deletion operations

This runbook is for authorised Master Minds Support Team / Extreme Admin staff. It is not a substitute for local legal advice. Never ask a requester to send a password, one-time code, payment-card details or identity documents through the public form or ordinary email.

## Request intake

1. An authenticated learner can submit a request from Settings. The request is recorded in `account_deletion_requests`, their profile is set to `suspended`, and the app signs them out.
2. A requester without the app can submit the public `/delete-account` form. The public Edge Function validates the input, applies per-IP and per-email rate limits, and records the request in the same queue with source `external_web`.
3. The public endpoint returns the same confirmation whether or not the submitted email matches an Auth account. It does not return an account ID, account status, or request ID.
4. The public intake stores only a keyed HMAC of IP/email for rate limiting; raw IP addresses are not persisted. Rate-limit storage is in a non-exposed schema and is not readable by client roles.
5. Only the Extreme Admin portal can list and review the global deletion queue. Public requests do not suspend or delete accounts automatically.

## Verification and review

1. Verify that the requester controls the account email using an approved verification channel. Do not treat knowledge of a username or email address as proof of ownership.
2. For a learner under 18, verify that the requester is an authorised parent or legal guardian before processing the request. Follow the child-safety and privacy procedures; do not ask the learner to provide sensitive identity documents through this form.
3. Mark a request `in_review` only after the required ownership/guardian verification. For a linked account, this status suspends the profile through the existing review RPC.
4. If a request is rejected, record a concise reason. The review RPC restores an existing account's profile status to active.
5. A request can be marked `completed` only after the linked Auth account has been deleted through the supported Supabase Auth Admin workflow. The request row uses `ON DELETE SET NULL`, so the linked user ID becomes null after Auth deletion.

## Before deleting an account

Master Minds contains school, academic, social, security and finance records with different ownership and retention needs. Do not run a broad delete against a user's rows and do not delete invoices, payments, transactions, school audit events or required academic records merely to make an Auth deletion succeed.

Review at least:

- Active school memberships, leadership appointments, class/teacher assignments and parent links. Arrange a handover where the account has an active responsibility.
- Student academic history, assessments, attendance and results. Determine what must remain as a school record and remove or de-identify personal references where appropriate.
- Finance invoices, payments, transaction references and finance audit events. Retain records required for financial accountability; restrict access and detach personal profile references where the schema supports it.
- Posts, comments, direct and group messages, uploaded images and other user-generated content. Remove or de-identify eligible personal content, while preserving records required for a report, safety investigation or legal hold.
- User-owned storage objects across all buckets, not only the social-images bucket.
- Reports, moderation history and security/audit events. Preserve the minimum necessary for safety, abuse prevention, disputes or legal obligations; remove unnecessary personal identifiers where possible.

If a foreign-key dependency or data ownership is unclear, stop and escalate to the database maintainer. Do not force-delete rows, disable constraints, or delete from `auth.users` with SQL.

## Complete the request

1. Verify the data review and any required handover are complete.
2. Remove or de-identify eligible personal data through the supported application/admin workflow or a reviewed maintenance procedure.
3. Delete the Auth account through the Supabase Dashboard's Auth user-management workflow or the supported Supabase Auth Admin API. Never delete Auth users with a direct SQL statement.
4. Refresh the Extreme Admin deletion queue. Confirm the request's linked `user_id` is null.
5. Mark the request completed and add a concise resolution note describing the categories removed and any categories retained with the reason. Do not put passwords, identity numbers or unnecessary personal details in the note.

## Automation boundary

Public intake, rate limiting, request deduplication, the audit queue and review status are implemented in the application. Full cross-table data erasure is intentionally not automated yet because school ownership, finance records, safety reports and storage layouts require per-table retention and handover rules. Do not describe a request as fully deleted until the review above has actually been completed.


## Production schema dependency inventory (2026-11-26)

A read-only PostgreSQL catalog review of the production project's foreign keys to `auth.users` and `public.profiles` found that deleting an Auth user is **not a simple cascade**. Several dependencies intentionally use `NO ACTION`, `RESTRICT`, or `SET NULL`. This catalog inventory identifies schema blockers only; it did not count per-request rows and is not a deletion clearance.

### Foreign-key dependencies that can block Auth deletion

The following Auth-user references use `NO ACTION` or `RESTRICT` and must be reviewed for the particular account before deletion:

- `auth.scim_users.user_id` (NO ACTION)
- `flashcards.user_id` (NO ACTION)
- `guardian_consent_requests.guardian_user_id` (NO ACTION)
- `school_assessments.reviewed_by`, `school_behavior_reports.reviewed_by`, and `school_disciplinary_recommendations.reviewed_by_user_id` (NO ACTION)
- `school_fee_payments.recorded_by`, `school_fee_structures.created_by`, `school_finance_audit_events.actor_id`, and `school_grading_policies.updated_by` (NO ACTION)
- `school_leadership_action_events.actor_user_id`, `school_leadership_audit_events.actor_user_id`, and `school_leadership_structure_events.actor_user_id` (NO ACTION)
- `school_memberships.user_id` (RESTRICT), `school_memberships.created_by`, and `school_memberships.question_submission_suspended_by` (NO ACTION)
- `school_networks.created_by`, `school_parent_student_links.linked_by`, `school_policy_settings.updated_by`, and `school_record_events.actor_id` (NO ACTION)
- `school_sections.homeroom_teacher_id`, `school_staff_change_requests.reviewed_by_user_id`, `school_student_invoices.created_by`, `school_subjects.created_by`, `school_teacher_assignments.created_by`, and `school_term_results.published_by` (NO ACTION)
- `school_student_id_reservations.reserved_by` and `used_by_user_id` (RESTRICT)
- `schools.created_by` (RESTRICT)
- `transactions.sender_id` and `receiver_id` (NO ACTION)

### Profile-level dependencies

- `finance_invoices.student_id` references the profile with RESTRICT; invoice history must not be discarded to satisfy account erasure.
- `social_posts.author_id` and `social_post_comments.user_id` use SET NULL when the profile is deleted. Content retention, de-identification, and safety-report context still need review before removal.
- `academic_profiles`, `profile_privacy_settings`, `upper_student_topic_progress`, `upper_student_daily_activity`, and `student_exam_targets` use CASCADE from profiles. Verify whether each record is eligible to erase or retain before deleting the profile.

### References that generally detach or cascade

Auth's own identity/session/MFA/token tables cascade. Other application references such as request/review actor IDs, moderation actors, finance audit actors, and platform-setting authors commonly use SET NULL. User-owned learning, notification, multiplayer, call, social-block, consent-child and onboarding records commonly cascade. **Do not assume cascade is appropriate for every data category**; the retention review and legal policy must determine what should remain, be anonymised, or be deleted first.

This inventory is not a substitute for a per-request blocker query, storage inventory, ownership handover, or legal retention decision. A future deletion tool must display these dependencies, require a documented verification and retention decision, and use the supported Auth Admin deletion path only after all blockers are cleared. No production rows were changed during this catalog review.
