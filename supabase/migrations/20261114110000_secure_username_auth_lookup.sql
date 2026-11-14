-- Stop exposing authentication email addresses through a public username lookup.
-- Username resolution and password verification now happen inside the username-auth
-- Edge Function; only the resulting auth session is returned to the caller.

revoke all on function public.get_email_by_username(text) from public, anon, authenticated;

create table if not exists public.username_auth_rate_limits (
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  bucket text not null check (bucket in ('availability', 'login')),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (key_hash, bucket)
);

alter table public.username_auth_rate_limits enable row level security;
revoke all on table public.username_auth_rate_limits from public, anon, authenticated;

create or replace function public.consume_username_auth_rate_limit(
  p_key_hash text,
  p_bucket text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_count integer;
  v_limit integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$'
     or p_bucket not in ('availability', 'login') then
    raise exception 'Invalid rate limit key';
  end if;

  -- Shared school networks should not lock out every student. Availability
  -- checks have a higher IP bucket; password attempts are isolated by
  -- (IP, username) and rely on Supabase Auth's own additional throttling.
  v_limit := case p_bucket
    when 'login' then 10
    else 200
  end;

  insert into public.username_auth_rate_limits as current_limit (
    key_hash, bucket, window_started_at, request_count
  )
  values (p_key_hash, p_bucket, now(), 1)
  on conflict (key_hash, bucket) do update
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

  return v_count <= v_limit;
end;
$function$;

revoke all on function public.consume_username_auth_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.consume_username_auth_rate_limit(text, text) to service_role;
