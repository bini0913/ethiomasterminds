# Master Minds account-deletion operations

This runbook is for authorised Master Minds Support Team / Extreme Admin staff. It is not a substitute for local legal advice. Never ask a requester to send a password, one-time code, or payment-card details.

## Current request flow

1. An authenticated learner can submit a request from Settings. The request is recorded in `account_deletion_requests`, their profile is set to `suspended`, and the app signs them out.
2. A requester without the app can use the public `/delete-account` page to prepare an email to `mindm1517@gmail.com`. Support must record the external request in the Extreme Admin portal.
3. Only the Extreme Admin portal can list and review the global deletion queue.
4. Mark a request `in_review` only after verifying the requester controls the account email. For a minor, verify that the requester is an authorised parent or legal guardian.
5. A request can be marked `completed` only after the linked Auth account has been deleted through the supported Supabase Auth Admin workflow. The request row uses `ON DELETE SET NULL`, so the linked user ID becomes null after Auth deletion.
6. If a request is rejected, record a clear reason. The review RPC restores an existing account's profile status to active.

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

## Outstanding automation

The request intake, account restriction, audit queue and review status are implemented. Full cross-table data erasure is intentionally not automated yet because school ownership, finance records, safety reports and storage layouts require per-table retention and handover rules. Do not describe a request as fully deleted until the review above has actually been completed.
