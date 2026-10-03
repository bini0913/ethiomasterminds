-- Restore the Super Admin security summary RPC used by deployed clients.
create or replace function public.extreme_admin_get_security()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_audit_events bigint;
  v_active_admins bigint;
  v_active_managers bigint;
  v_suspended_users bigint;
  v_banned_users bigint;
begin
  if not public._is_extreme_admin() then
    raise exception 'Super Admin access required';
  end if;

  select count(*) into v_audit_events from public.admin_audit_logs;

  select count(*) into v_active_admins
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.role in ('admin'::public.app_role, 'extreme_admin'::public.app_role)
    and coalesce(p.account_status, 'active') = 'active';

  select count(*) into v_active_managers
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.role = 'manager'::public.app_role
    and coalesce(p.account_status, 'active') = 'active';

  select count(*) into v_suspended_users from public.profiles where account_status = 'suspended';
  select count(*) into v_banned_users from public.profiles where account_status = 'banned';

  return jsonb_build_object(
    'audit_events', v_audit_events,
    'active_admins', v_active_admins,
    'active_managers', v_active_managers,
    'suspended_users', v_suspended_users,
    'banned_users', v_banned_users,
    'security_audit_events', v_audit_events
  );
end;
$$;

revoke all on function public.extreme_admin_get_security() from public;
grant execute on function public.extreme_admin_get_security() to authenticated;
