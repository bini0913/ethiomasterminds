-- Public, privacy-safe intake for external account-deletion requests.
-- Requests are queued for manual ownership/guardian verification; this does not
-- suspend or delete an account and does not reveal whether an email exists.

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_source_check;
alter table public.account_deletion_requests
  add constraint account_deletion_requests_source_check
  check (source in ('in_app', 'external_email', 'external_web'));

alter table public.account_deletion_requests
  add column if not exists requester_note text;

create unique index if not exists account_deletion_requests_external_web_pending_email_uidx
  on public.account_deletion_requests (lower(requested_email))
  where source = 'external_web' and status in ('pending', 'in_review');

create schema if not exists deletion_private;

create table if not exists deletion_private.external_deletion_request_rate_limits (
  key_hash text not null,
  bucket text not null check (bucket in ('ip', 'email')),
  window_started_at timestamptz not null,
  attempts integer not null check (attempts >= 0),
  primary key (key_hash, bucket),
  check (key_hash ~ '^[0-9a-f]{64}$')
);

alter table deletion_private.external_deletion_request_rate_limits enable row level security;
revoke all on schema deletion_private from public, anon, authenticated;
revoke all on deletion_private.external_deletion_request_rate_limits from public, anon, authenticated, service_role;

create or replace function public.consume_external_deletion_rate_limit(
  p_key_hash text,
  p_bucket text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_allowed boolean;
begin
  if p_key_hash is null then
    raise exception 'Invalid rate-limit key';
  end if;
  if length(p_key_hash) <> 64 then
    raise exception 'Invalid rate-limit key';
  end if;
  if p_key_hash ~ '[^0-9a-f]' then
    raise exception 'Invalid rate-limit key';
  end if;
  if p_bucket is null then
    raise exception 'Invalid rate-limit bucket';
  end if;
  if p_bucket <> 'ip' then
    if p_bucket <> 'email' then
      raise exception 'Invalid rate-limit bucket';
    end if;
  end if;
  if p_max_attempts is null then
    raise exception 'Invalid rate-limit attempt limit';
  end if;
  if p_max_attempts < 1 then
    raise exception 'Invalid rate-limit attempt limit';
  end if;
  if p_max_attempts > 20 then
    raise exception 'Invalid rate-limit attempt limit';
  end if;
  if p_window_seconds is null then
    raise exception 'Invalid rate-limit window';
  end if;
  if p_window_seconds < 60 then
    raise exception 'Invalid rate-limit window';
  end if;
  if p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit window';
  end if;

  insert into deletion_private.external_deletion_request_rate_limits
    (key_hash, bucket, window_started_at, attempts)
  values (p_key_hash, p_bucket, v_now, 1)
  on conflict (key_hash, bucket) do update
    set window_started_at = case
          when deletion_private.external_deletion_request_rate_limits.window_started_at
               <= v_now - make_interval(secs => p_window_seconds)
            then v_now
          else deletion_private.external_deletion_request_rate_limits.window_started_at
        end,
        attempts = case
          when deletion_private.external_deletion_request_rate_limits.window_started_at
               <= v_now - make_interval(secs => p_window_seconds)
            then 1
          else deletion_private.external_deletion_request_rate_limits.attempts + 1
        end
  returning attempts <= p_max_attempts into v_allowed;

  delete from deletion_private.external_deletion_request_rate_limits
   where window_started_at < v_now - interval '7 days';

  return v_allowed;
end;
$$;

create or replace function public.submit_external_deletion_request(
  p_email text,
  p_username text default null,
  p_requester_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_username text := nullif(btrim(coalesce(p_username, '')), '');
  v_note text := nullif(left(btrim(coalesce(p_requester_note, '')), 500), '');
  v_user_id uuid;
  v_request_id uuid;
begin
  if length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required';
  end if;
  if v_username is not null and length(v_username) > 40 then
    raise exception 'Username is too long';
  end if;

  select u.id into v_user_id
    from auth.users u
   where lower(u.email) = v_email
   limit 1;

  select r.id into v_request_id
    from public.account_deletion_requests r
   where lower(r.requested_email) = v_email
     and r.source = 'external_web'
     and r.status in ('pending', 'in_review')
   order by r.requested_at desc
   limit 1;

  if v_request_id is not null then
    update public.account_deletion_requests
       set user_id = coalesce(user_id, v_user_id),
           requested_username = coalesce(requested_username, v_username),
           requester_note = coalesce(requester_note, v_note)
     where id = v_request_id;
    return v_request_id;
  end if;

  insert into public.account_deletion_requests (
    user_id, requested_email, requested_username, source, status, requester_note
  ) values (
    v_user_id, v_email, v_username, 'external_web', 'pending', v_note
  )
  on conflict do nothing
  returning id into v_request_id;

  if v_request_id is null then
    select r.id into v_request_id
      from public.account_deletion_requests r
     where lower(r.requested_email) = v_email
       and r.source = 'external_web'
       and r.status in ('pending', 'in_review')
     order by r.requested_at desc
     limit 1;
  end if;

  if v_request_id is null then
    raise exception 'Deletion request could not be recorded';
  end if;

  insert into public.account_deletion_request_events(request_id, actor_id, action, note)
  values (
    v_request_id,
    null,
    'requested_external_web',
    'Submitted through the public account-deletion request page. Ownership verification is pending.'
  );

  return v_request_id;
end;
$$;

revoke all on function public.consume_external_deletion_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_external_deletion_rate_limit(text, text, integer, integer)
  to service_role;

revoke all on function public.submit_external_deletion_request(text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_external_deletion_request(text, text, text)
  to service_role;

drop function if exists public.extreme_admin_list_account_deletion_requests(text, integer);
create function public.extreme_admin_list_account_deletion_requests(
  p_status text default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  user_id uuid,
  requested_email text,
  requested_username text,
  requester_note text,
  source text,
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  resolution_note text
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.has_role(v_actor, 'extreme_admin'::public.app_role) then
    raise exception using errcode = '42501', message = 'Extreme Admin access required';
  end if;

  return query
  select r.id, r.user_id, r.requested_email, r.requested_username, r.requester_note,
         r.source, r.status, r.requested_at, r.reviewed_at, r.reviewed_by, r.resolution_note
    from public.account_deletion_requests r
   where p_status is null or r.status = p_status
   order by r.requested_at desc
   limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

revoke all on function public.extreme_admin_list_account_deletion_requests(text, integer)
  from public, anon;
grant execute on function public.extreme_admin_list_account_deletion_requests(text, integer)
  to authenticated;

-- A reviewer must record an explicit resolution before closing a request.
create or replace function public.extreme_admin_update_account_deletion_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.account_deletion_requests%rowtype;
  v_note text := nullif(left(trim(coalesce(p_note, '')), 2000), '');
begin
  if v_actor is null or not public.has_role(v_actor, 'extreme_admin'::public.app_role) then
    raise exception using errcode = '42501', message = 'Extreme Admin access required';
  end if;
  if p_status not in ('in_review', 'completed', 'rejected') then
    raise exception 'Unsupported deletion-request status';
  end if;
  if p_status = 'completed' and v_note is null then
    raise exception 'A resolution note is required before completing a deletion request';
  end if;

  select * into v_request
    from public.account_deletion_requests
   where id = p_request_id
   for update;
  if not found then raise exception 'Deletion request not found'; end if;

  if p_status = 'completed' and v_request.user_id is not null then
    raise exception 'The account must be deleted through the supported Auth Admin workflow before this request can be marked complete';
  end if;

  if p_status = 'in_review' and v_request.user_id is not null then
    update public.profiles set account_status = 'suspended' where id = v_request.user_id;
  end if;

  if p_status = 'rejected' and v_request.user_id is not null then
    update public.profiles set account_status = 'active' where id = v_request.user_id;
  end if;

  update public.account_deletion_requests
     set status = p_status,
         reviewed_at = now(),
         reviewed_by = v_actor,
         resolution_note = coalesce(v_note, resolution_note)
   where id = p_request_id
   returning * into v_request;

  insert into public.account_deletion_request_events(request_id, actor_id, action, note)
  values (v_request.id, v_actor, p_status, v_note);

  return v_request;
end;
$$;

revoke all on function public.extreme_admin_update_account_deletion_request(uuid, text, text)
  from public, anon;
grant execute on function public.extreme_admin_update_account_deletion_request(uuid, text, text)
  to authenticated;

     or p_bucket is null or p_bucket not in ('ip', 'email')
     or p_max_attempts is null or p_max_attempts < 1 or p_max_attempts > 20
     or p_window_seconds is null or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit parameters';
  end if;

  insert into deletion_private.external_deletion_request_rate_limits
    (key_hash, bucket, window_started_at, attempts)
  values (p_key_hash, p_bucket, v_now, 1)
  on conflict (key_hash, bucket) do update
    set window_started_at = case
          when deletion_private.external_deletion_request_rate_limits.window_started_at
               <= v_now - make_interval(secs => p_window_seconds)
            then v_now
          else deletion_private.external_deletion_request_rate_limits.window_started_at
        end,
        attempts = case
          when deletion_private.external_deletion_request_rate_limits.window_started_at
               <= v_now - make_interval(secs => p_window_seconds)
            then 1
          else deletion_private.external_deletion_request_rate_limits.attempts + 1
        end
  returning attempts <= p_max_attempts into v_allowed;

  delete from deletion_private.external_deletion_request_rate_limits
   where window_started_at < v_now - interval '7 days';

  return v_allowed;
end;
$$;

create or replace function public.submit_external_deletion_request(
  p_email text,
  p_username text default null,
  p_requester_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_username text := nullif(btrim(coalesce(p_username, '')), '');
  v_note text := nullif(left(btrim(coalesce(p_requester_note, '')), 500), '');
  v_user_id uuid;
  v_request_id uuid;
begin
  if length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required';
  end if;
  if v_username is not null and length(v_username) > 40 then
    raise exception 'Username is too long';
  end if;

  select u.id into v_user_id
    from auth.users u
   where lower(u.email) = v_email
   limit 1;

  select r.id into v_request_id
    from public.account_deletion_requests r
   where lower(r.requested_email) = v_email
     and r.source = 'external_web'
     and r.status in ('pending', 'in_review')
   order by r.requested_at desc
   limit 1;

  if v_request_id is not null then
    update public.account_deletion_requests
       set user_id = coalesce(user_id, v_user_id),
           requested_username = coalesce(requested_username, v_username),
           requester_note = coalesce(requester_note, v_note)
     where id = v_request_id;
    return v_request_id;
  end if;

  insert into public.account_deletion_requests (
    user_id, requested_email, requested_username, source, status, requester_note
  ) values (
    v_user_id, v_email, v_username, 'external_web', 'pending', v_note
  )
  on conflict do nothing
  returning id into v_request_id;

  if v_request_id is null then
    select r.id into v_request_id
      from public.account_deletion_requests r
     where lower(r.requested_email) = v_email
       and r.source = 'external_web'
       and r.status in ('pending', 'in_review')
     order by r.requested_at desc
     limit 1;
  end if;

  if v_request_id is null then
    raise exception 'Deletion request could not be recorded';
  end if;

  insert into public.account_deletion_request_events(request_id, actor_id, action, note)
  values (
    v_request_id,
    null,
    'requested_external_web',
    'Submitted through the public account-deletion request page. Ownership verification is pending.'
  );

  return v_request_id;
end;
$$;

revoke all on function public.consume_external_deletion_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_external_deletion_rate_limit(text, text, integer, integer)
  to service_role;

revoke all on function public.submit_external_deletion_request(text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_external_deletion_request(text, text, text)
  to service_role;

drop function if exists public.extreme_admin_list_account_deletion_requests(text, integer);
create function public.extreme_admin_list_account_deletion_requests(
  p_status text default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  user_id uuid,
  requested_email text,
  requested_username text,
  requester_note text,
  source text,
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  resolution_note text
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.has_role(v_actor, 'extreme_admin'::public.app_role) then
    raise exception using errcode = '42501', message = 'Extreme Admin access required';
  end if;

  return query
  select r.id, r.user_id, r.requested_email, r.requested_username, r.requester_note,
         r.source, r.status, r.requested_at, r.reviewed_at, r.reviewed_by, r.resolution_note
    from public.account_deletion_requests r
   where p_status is null or r.status = p_status
   order by r.requested_at desc
   limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

revoke all on function public.extreme_admin_list_account_deletion_requests(text, integer)
  from public, anon;
grant execute on function public.extreme_admin_list_account_deletion_requests(text, integer)
  to authenticated;

-- A reviewer must record an explicit resolution before closing a request.
create or replace function public.extreme_admin_update_account_deletion_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.account_deletion_requests%rowtype;
  v_note text := nullif(left(trim(coalesce(p_note, '')), 2000), '');
begin
  if v_actor is null or not public.has_role(v_actor, 'extreme_admin'::public.app_role) then
    raise exception using errcode = '42501', message = 'Extreme Admin access required';
  end if;
  if p_status not in ('in_review', 'completed', 'rejected') then
    raise exception 'Unsupported deletion-request status';
  end if;
  if p_status = 'completed' and v_note is null then
    raise exception 'A resolution note is required before completing a deletion request';
  end if;

  select * into v_request
    from public.account_deletion_requests
   where id = p_request_id
   for update;
  if not found then raise exception 'Deletion request not found'; end if;

  if p_status = 'completed' and v_request.user_id is not null then
    raise exception 'The account must be deleted through the supported Auth Admin workflow before this request can be marked complete';
  end if;

  if p_status = 'in_review' and v_request.user_id is not null then
    update public.profiles set account_status = 'suspended' where id = v_request.user_id;
  end if;

  if p_status = 'rejected' and v_request.user_id is not null then
    update public.profiles set account_status = 'active' where id = v_request.user_id;
  end if;

  update public.account_deletion_requests
     set status = p_status,
         reviewed_at = now(),
         reviewed_by = v_actor,
         resolution_note = coalesce(v_note, resolution_note)
   where id = p_request_id
   returning * into v_request;

  insert into public.account_deletion_request_events(request_id, actor_id, action, note)
  values (v_request.id, v_actor, p_status, v_note);

  return v_request;
end;
$$;

revoke all on function public.extreme_admin_update_account_deletion_request(uuid, text, text)
  from public, anon;
grant execute on function public.extreme_admin_update_account_deletion_request(uuid, text, text)
  to authenticated;
