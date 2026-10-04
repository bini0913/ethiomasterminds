-- Comprehensive QA/security stabilization
-- 1) Keep privileged role mutation behind an authenticated, caller-aware RPC.
-- 2) Remove anonymous access to the email-by-username primitive.
-- 3) Keep has_role callable by authenticated RLS policies, but never by anon.
-- 4) Seed a safe username availability primitive for unauthenticated signup.

create or replace function public.assign_user_role(
  _user_id uuid,
  _role app_role
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if _user_id = v_caller and _role = 'student' then
    insert into public.user_roles (user_id, role)
    values (_user_id, 'student')
    on conflict (user_id, role) do nothing;
    return true;
  end if;

  if not (
    public.has_role(v_caller, 'admin')
    or public.has_role(v_caller, 'manager')
    or public.has_role(v_caller, 'extreme_admin')
  ) then
    raise exception 'Not authorized';
  end if;

  if _role in ('admin', 'manager', 'extreme_admin')
     and not public.has_role(v_caller, 'extreme_admin') then
    raise exception 'Only super-admin can grant this role';
  end if;

  insert into public.user_roles (user_id, role)
  values (_user_id, _role)
  on conflict (user_id, role) do nothing;

  return true;
end;
$$;

revoke all on function public.assign_user_role(uuid, app_role) from public, anon;
grant execute on function public.assign_user_role(uuid, app_role) to authenticated;

revoke all on function public.get_email_by_username(text) from public, anon;
grant execute on function public.get_email_by_username(text) to authenticated;

create or replace function public.is_username_available(_username text)
returns boolean
language sql
stable
security invoker
as $$
  select not exists (
    select 1
    from public.profiles
    where lower(trim(username)) = lower(trim(_username))
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

revoke all on function public.has_role(uuid, app_role) from public, anon;
grant execute on function public.has_role(uuid, app_role) to authenticated;
