-- Stop exposing authentication email addresses through a public username lookup.
-- Username resolution and password verification now happen inside the username-auth
-- Edge Function; only the resulting auth session is returned to the caller.

revoke all on function public.get_email_by_username(text) from public, anon, authenticated;

create table if not exists public.username_auth_rate_limits (
  ip_hash text primary key check (ip_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.username_auth_rate_limits enable row level security;
revoke all on table public.username_auth_rate_limits from public, anon, authenticated;

create or replace function public.consume_username_auth_rate_limit(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_count integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid rate limit key';
  end if;

  insert into public.username_auth_rate_limits as current_limit (
    ip_hash, window_started_at, request_count
  )
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update
    set window_started_at = case
          when current_limit.window_started_at < now() - interval '15 minutes' then now()
          else current_limit.window_started_at
        end,
        request_count = case
          when current_limit.window_started_at < now() - interval '15 minutes' then 1
          else current_limit.request_count + 1
        end
  returning request_count into v_count;

  delete from public.username_auth_rate_limits
  where window_started_at < now() - interval '1 day';

  return v_count <= 30;
end;
$function$;

revoke all on function public.consume_username_auth_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_username_auth_rate_limit(text) to service_role;
