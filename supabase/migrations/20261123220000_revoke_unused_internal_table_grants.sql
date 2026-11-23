-- These tables are internal storage accessed through guarded SECURITY DEFINER RPCs
-- or trusted server-side jobs. RLS is enabled with no direct-client policies, so
-- direct anon/authenticated table grants are unnecessary and should be removed.
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE
  public.admin_audit_logs,
  public.edge_request_rate_limits,
  public.platform_settings
FROM anon, authenticated;

COMMIT;
