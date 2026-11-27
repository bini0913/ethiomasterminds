BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(3);
SELECT ok(
  to_regclass('public.support_request_statuses_user_id_idx') IS NOT NULL,
  'support-status author RLS lookup has an index'
);
SELECT ok(
  to_regclass('public.support_request_statuses_updated_by_idx') IS NOT NULL,
  'support-status updater foreign key has an index'
);
SELECT ok(
  to_regclass('public.account_deletion_requests_reviewed_by_idx') IS NOT NULL,
  'account-deletion reviewer foreign key has an index'
);
SELECT * FROM finish();
ROLLBACK;
