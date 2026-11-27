-- Part 1: index the support-status RLS owner key and its audit foreign key.
-- These indexes support the author-only SELECT policy and status-change audit lookup.
CREATE INDEX IF NOT EXISTS support_request_statuses_user_id_idx
  ON public.support_request_statuses(user_id);
CREATE INDEX IF NOT EXISTS support_request_statuses_updated_by_idx
  ON public.support_request_statuses(updated_by);
CREATE INDEX IF NOT EXISTS account_deletion_requests_reviewed_by_idx
  ON public.account_deletion_requests(reviewed_by);
