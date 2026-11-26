-- Keep the public role helper self-scoped. Cross-account role checks are
-- reserved for trusted SECURITY DEFINER workflows in the private schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role;

create or replace function private.has_role_for_user(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
      from public.user_roles ur
      join public.profiles p on p.id = ur.user_id
     where ur.user_id = _user_id
       and ur.role = _role
       and coalesce(p.account_status, 'active') = 'active'
  );
$$;
revoke all on function private.has_role_for_user(uuid, public.app_role) from public, anon, authenticated;
grant execute on function private.has_role_for_user(uuid, public.app_role) to postgres, service_role;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_current_user_id uuid := auth.uid();
begin
  if v_current_user_id is not null and _user_id is distinct from v_current_user_id then
    return false;
  end if;
  return private.has_role_for_user(_user_id, _role);
end;
$$;

-- This internal helper intentionally checks another account's role while
-- deciding whether that account is exempt from child feature controls.
create or replace function public.is_user_feature_enabled(p_user_id uuid, p_feature text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_age integer;
  v_status text;
  v_consent boolean;
  v_enabled boolean;
begin
  if p_user_id is null then return false; end if;
  select p.age, p.guardian_consent_status, p.guardian_consent
    into v_age, v_status, v_consent
    from public.profiles p where p.id = p_user_id;
  if not found then return false; end if;

  if v_age is not null and v_age >= 18 then return true; end if;
  if v_age is null then
    return private.has_role_for_user(p_user_id, 'parent'::public.app_role)
      or private.has_role_for_user(p_user_id, 'teacher'::public.app_role)
      or private.has_role_for_user(p_user_id, 'manager'::public.app_role)
      or private.has_role_for_user(p_user_id, 'admin'::public.app_role)
      or private.has_role_for_user(p_user_id, 'finance'::public.app_role)
      or private.has_role_for_user(p_user_id, 'super_admin'::public.app_role)
      or private.has_role_for_user(p_user_id, 'extreme_admin'::public.app_role);
  end if;
  if v_age < 18 and (not coalesce(v_consent, false) or v_status <> 'verified') then return false; end if;

  select case p_feature
    when 'social' then c.social_enabled
    when 'friend_requests' then c.friend_requests_enabled
    when 'direct_messages' then c.direct_messages_enabled
    when 'multiplayer' then c.multiplayer_enabled
    when 'calls' then c.calls_enabled
    else false
  end into v_enabled
  from public.guardian_child_controls c
  where c.child_id = p_user_id and c.guardian_user_id = (
    select p.guardian_user_id from public.profiles p where p.id = p_user_id
  );
  return coalesce(v_enabled, false);
end;
$$;

create or replace function public.extreme_admin_set_super_admin(p_user_id uuid, p_enabled boolean, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_previous_user_id uuid;
begin
  if not public._is_extreme_admin() then
    raise exception 'Extreme Admin access required';
  end if;

  if p_user_id is null then
    raise exception 'A target account is required';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'The Extreme Admin cannot also be the Super Admin';
  end if;

  perform pg_advisory_xact_lock(hashtext('master_minds.super_admin.singleton')::bigint);

  if p_enabled then
    if not exists (select 1 from auth.users where id = p_user_id) then
      raise exception 'Target account does not exist';
    end if;

    if not exists (
      select 1 from public.profiles
      where id = p_user_id and coalesce(account_status, 'active') = 'active'
    ) then
      raise exception 'The Super Admin account must have an active profile';
    end if;

    if private.has_role_for_user(p_user_id, 'extreme_admin'::public.app_role) then
      raise exception 'The Extreme Admin account cannot become Super Admin';
    end if;

    select user_id
      into v_previous_user_id
      from public.user_roles
     where role = 'super_admin'::public.app_role
     for update;

    if v_previous_user_id is not null and v_previous_user_id <> p_user_id then
      delete from public.user_roles
       where user_id = v_previous_user_id
         and role = 'super_admin'::public.app_role;
    end if;

    insert into public.user_roles (user_id, role)
    values (p_user_id, 'super_admin'::public.app_role)
    on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles
     where user_id = p_user_id
       and role = 'super_admin'::public.app_role;
  end if;

  insert into public.admin_audit_logs (
    actor_id, action, target_type, target_id, metadata
  )
  values (
    auth.uid(),
    case when p_enabled then 'set_super_admin' else 'revoke_super_admin' end,
    'user',
    p_user_id,
    jsonb_build_object(
      'enabled', p_enabled,
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'replaced_user_id', v_previous_user_id
    )
  );

  return true;
end;
$$;
