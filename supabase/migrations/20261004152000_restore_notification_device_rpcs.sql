-- Restore the notification device RPCs used by the Android push registration flow.
-- These functions are intentionally SECURITY DEFINER so RLS does not prevent
-- an authenticated user from registering or disabling their own device token.

create or replace function public.upsert_notification_device(
  p_token text,
  p_platform text,
  p_app_version text default null,
  p_enabled boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_token is null or length(trim(p_token)) < 10 or length(p_token) > 4096 then
    raise exception 'Invalid notification token';
  end if;

  if p_platform is null or p_platform not in ('android', 'ios') then
    raise exception 'Unsupported notification platform';
  end if;

  select id
    into v_id
    from public.notification_devices
   where user_id = v_user_id
     and token = p_token
   limit 1;

  if v_id is null then
    insert into public.notification_devices (
      user_id,
      token,
      platform,
      app_version,
      enabled,
      last_seen_at,
      created_at,
      updated_at
    )
    values (
      v_user_id,
      trim(p_token),
      p_platform,
      p_app_version,
      coalesce(p_enabled, true),
      now(),
      now(),
      now()
    )
    returning id into v_id;
  else
    update public.notification_devices
       set platform = p_platform,
           app_version = p_app_version,
           enabled = coalesce(p_enabled, true),
           last_seen_at = now(),
           updated_at = now()
     where id = v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.disable_notification_device(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_token is null or length(trim(p_token)) < 10 then
    return false;
  end if;

  update public.notification_devices
     set enabled = false,
         updated_at = now()
   where user_id = v_user_id
     and token = trim(p_token);

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.upsert_notification_device(text, text, text, boolean) from public;
grant execute on function public.upsert_notification_device(text, text, text, boolean) to authenticated;

revoke all on function public.disable_notification_device(text) from public;
grant execute on function public.disable_notification_device(text) to authenticated;