-- Safe account-deletion request workflow.
-- The previous delete_my_account() function removed financial invoices and did not
-- cover every school/audit dependency. Disable direct client execution until the
-- complete retention-aware deletion pipeline is implemented and verified.
revoke all on function public.delete_my_account() from public, anon, authenticated;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  requested_email text not null,
  requested_username text,
  source text not null check (source in ('in_app', 'external_email')),
  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  resolution_note text
);

create index if not exists account_deletion_requests_status_idx
  on public.account_deletion_requests (status, requested_at desc);
create index if not exists account_deletion_requests_user_id_idx
  on public.account_deletion_requests (user_id, requested_at desc);

create table if not exists public.account_deletion_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.account_deletion_requests(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists account_deletion_request_events_request_idx
  on public.account_deletion_request_events (request_id, created_at desc);

alter table public.account_deletion_requests enable row level security;
alter table public.account_deletion_request_events enable row level security;
revoke all on public.account_deletion_requests from anon, authenticated;
revoke all on public.account_deletion_request_events from anon, authenticated;
grant select on public.account_deletion_requests to authenticated;
grant select on public.account_deletion_request_events to authenticated;

drop policy if exists "Users can view their own deletion requests" on public.account_deletion_requests;
create policy "Users can view their own deletion requests"
  on public.account_deletion_requests for select to authenticated
  using (
    user_id = (select auth.uid())
    or has_role((select auth.uid()), 'extreme_admin'::app_role)
  );

drop policy if exists "Extreme Admin can view deletion request events" on public.account_deletion_request_events;
create policy "Extreme Admin can view deletion request events"
  on public.account_deletion_request_events for select to authenticated
  using (has_role((select auth.uid()), 'extreme_admin'::app_role));

create or replace function public.request_my_account_deletion()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_username text;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select u.email into v_email from auth.users u where u.id = v_user_id;
  select p.username into v_username from public.profiles p where p.id = v_user_id;
  if v_email is null then raise exception 'Account email could not be verified'; end if;

  select r.id into v_request_id
    from public.account_deletion_requests r
   where r.user_id = v_user_id and r.status in ('pending', 'in_review')
   order by r.requested_at desc
   limit 1;
  if v_request_id is not null then return v_request_id; end if;

  insert into public.account_deletion_requests(user_id, requested_email, requested_username, source)
  values (v_user_id, v_email, v_username, 'in_app')
  returning id into v_request_id;

  insert into public.account_deletion_request_events(request_id, actor_id, action, note)
  values (v_request_id, v_user_id, 'requested_in_app', 'Account deletion requested from app settings.');

  update public.profiles
     set account_status = case when account_status = 'active' then 'suspended' else account_status end
   where id = v_user_id;

  return v_request_id;
end;
$$;

revoke all on function public.request_my_account_deletion() from public, anon;
grant execute on function public.request_my_account_deletion() to authenticated;

create or replace function public.extreme_admin_list_account_deletion_requests(
  p_status text default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  user_id uuid,
  requested_email text,
  requested_username text,
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
  select r.id, r.user_id, r.requested_email, r.requested_username, r.source,
         r.status, r.requested_at, r.reviewed_at, r.reviewed_by, r.resolution_note
    from public.account_deletion_requests r
   where p_status is null or r.status = p_status
   order by r.requested_at desc
   limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

create or replace function public.extreme_admin_create_external_deletion_request(
  p_email text,
  p_username text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_request_id uuid;
  v_user_id uuid;
begin
  if v_actor is null or not public.has_role(v_actor, 'extreme_admin'::public.app_role) then
    raise exception using errcode = '42501', message = 'Extreme Admin access required';
  end if;
  if p_email is null or position('@' in trim(p_email)) < 2 then
    raise exception 'A valid account email is required';
  end if;

  select u.id into v_user_id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
  insert into public.account_deletion_requests(user_id, requested_email, requested_username, source, status, resolution_note)
  values (v_user_id, lower(trim(p_email)), nullif(trim(p_username), ''), 'external_email', 'pending', nullif(left(trim(coalesce(p_note, '')), 2000), ''))
  returning id into v_request_id;

  insert into public.account_deletion_request_events(request_id, actor_id, action, note)
  values (v_request_id, v_actor, 'external_request_logged', 'External email request recorded by Extreme Admin.');
  return v_request_id;
end;
$$;

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

revoke all on function public.extreme_admin_list_account_deletion_requests(text, integer) from public, anon;
grant execute on function public.extreme_admin_list_account_deletion_requests(text, integer) to authenticated;
revoke all on function public.extreme_admin_create_external_deletion_request(text, text, text) from public, anon;
grant execute on function public.extreme_admin_create_external_deletion_request(text, text, text) to authenticated;
revoke all on function public.extreme_admin_update_account_deletion_request(uuid, text, text) from public, anon;
grant execute on function public.extreme_admin_update_account_deletion_request(uuid, text, text) to authenticated;

comment on table public.account_deletion_requests is 'Verified, auditable requests to delete a Master Minds account and its eligible personal data.';
