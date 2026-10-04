-- Harden role-management and rate-limit function privileges.
-- Keep role assignment aligned with the protected assign-role Edge Function.

revoke execute on function public.consume_edge_rate_limit(text, integer, integer) from public;
revoke execute on function public.consume_edge_rate_limit(text, integer, integer) from anon;
grant execute on function public.consume_edge_rate_limit(text, integer, integer) to authenticated;

revoke execute on function public._is_extreme_admin() from public;
revoke execute on function public._is_extreme_admin() from anon;
grant execute on function public._is_extreme_admin() to authenticated;

revoke execute on function public._is_manager_or_admin() from public;
revoke execute on function public._is_manager_or_admin() from anon;
grant execute on function public._is_manager_or_admin() to authenticated;

revoke execute on function public.has_role(uuid, public.app_role) from public;
revoke execute on function public.has_role(uuid, public.app_role) from anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

revoke execute on function public.get_user_role(uuid) from public;
revoke execute on function public.get_user_role(uuid) from anon;
grant execute on function public.get_user_role(uuid) to authenticated;

revoke execute on function public.assign_user_role(uuid, public.app_role) from public;
revoke execute on function public.assign_user_role(uuid, public.app_role) from anon;
grant execute on function public.assign_user_role(uuid, public.app_role) to authenticated;

create or replace function public.assign_user_role(_user_id uuid, _role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if _user_id = auth.uid() then
    if _role <> 'student'::public.app_role then
      raise exception 'Users may only self-assign the student role';
    end if;
  elsif public._is_extreme_admin() then
    null;
  elsif public.has_role(auth.uid(), 'admin'::public.app_role) then
    if _role not in ('student'::public.app_role, 'teacher'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role) then
      raise exception 'Admins cannot grant this role';
    end if;
  elsif public.has_role(auth.uid(), 'manager'::public.app_role) then
    if _role not in ('student'::public.app_role, 'teacher'::public.app_role) then
      raise exception 'Managers can only grant student or teacher roles';
    end if;
  else
    raise exception 'Not authorized';
  end if;

  insert into public.user_roles (user_id, role)
  values (_user_id, _role)
  on conflict (user_id, role) do nothing;
end;
$function$;

drop policy if exists "Admins can manage roles" on public.user_roles;

create policy "Role managers can insert allowed roles"
on public.user_roles
for insert to authenticated
with check (
  public._is_extreme_admin()
  or (public.has_role(auth.uid(), 'admin'::public.app_role) and role in ('student'::public.app_role, 'teacher'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role))
  or (public.has_role(auth.uid(), 'manager'::public.app_role) and role in ('student'::public.app_role, 'teacher'::public.app_role))
);

create policy "Role managers can update allowed roles"
on public.user_roles
for update to authenticated
using (
  public._is_extreme_admin()
  or (public.has_role(auth.uid(), 'admin'::public.app_role) and role in ('student'::public.app_role, 'teacher'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role))
  or (public.has_role(auth.uid(), 'manager'::public.app_role) and role in ('student'::public.app_role, 'teacher'::public.app_role))
)
with check (
  public._is_extreme_admin()
  or (public.has_role(auth.uid(), 'admin'::public.app_role) and role in ('student'::public.app_role, 'teacher'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role))
  or (public.has_role(auth.uid(), 'manager'::public.app_role) and role in ('student'::public.app_role, 'teacher'::public.app_role))
);

create policy "Role managers can delete allowed roles"
on public.user_roles
for delete to authenticated
using (
  public._is_extreme_admin()
  or (public.has_role(auth.uid(), 'admin'::public.app_role) and role in ('student'::public.app_role, 'teacher'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role))
  or (public.has_role(auth.uid(), 'manager'::public.app_role) and role in ('student'::public.app_role, 'teacher'::public.app_role))
);
