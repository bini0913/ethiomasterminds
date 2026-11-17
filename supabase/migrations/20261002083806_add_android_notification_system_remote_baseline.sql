-- Reconstructed from the production baseline. The original migration file was
-- absent locally even though this version is applied remotely.

create table if not exists public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  app_version text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists notification_devices_user_enabled_idx
  on public.notification_devices (user_id, enabled);

alter table public.notification_devices enable row level security;
drop policy if exists "Users read own notification devices" on public.notification_devices;
create policy "Users read own notification devices"
  on public.notification_devices for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.upsert_notification_device(
  p_token text,
  p_platform text,
  p_app_version text,
  p_enabled boolean default true
)
returns public.notification_devices
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_device public.notification_devices;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_token), '') is null then raise exception 'Notification token is required'; end if;
  insert into public.notification_devices (user_id, token, platform, app_version, enabled, last_seen_at, updated_at)
  values (v_user_id, trim(p_token), coalesce(nullif(trim(p_platform), ''), 'android'), p_app_version, coalesce(p_enabled, true), now(), now())
  on conflict (user_id, token) do update set
    platform = excluded.platform,
    app_version = excluded.app_version,
    enabled = excluded.enabled,
    last_seen_at = now(),
    updated_at = now()
  returning * into v_device;
  return v_device;
end;
$$;

create or replace function public.disable_notification_device(p_token text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.notification_devices
  set enabled = false, updated_at = now()
  where user_id = auth.uid() and token = trim(p_token);
end;
$$;

revoke all on function public.upsert_notification_device(text, text, text, boolean) from public, anon;
grant execute on function public.upsert_notification_device(text, text, text, boolean) to authenticated;
revoke all on function public.disable_notification_device(text) from public, anon;
grant execute on function public.disable_notification_device(text) to authenticated;
