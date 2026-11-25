-- Preserve the account's pre-request state when a deletion request is rejected.
-- A deletion review must never reactivate an account that was already suspended
-- or banned for an unrelated safety, school, or security reason.

alter table public.account_deletion_requests
  add column if not exists previous_account_status text,
  add column if not exists suspension_applied_by_request boolean not null default false;

comment on column public.account_deletion_requests.previous_account_status is
  'Account status immediately before this deletion request itself suspended the profile; retained for safe rejection rollback.';
comment on column public.account_deletion_requests.suspension_applied_by_request is
  'True only when this deletion request changed an active profile to suspended. Rejection may restore the previous status only while the profile remains suspended.';

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
  v_account_status text;
  v_request_id uuid;
  v_suspended_by_request boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select u.email into v_email from auth.users u where u.id = v_user_id;
  select p.username, p.account_status
    into v_username, v_account_status
    from public.profiles p
   where p.id = v_user_id
   for update;

  if v_email is null then raise exception 'Account email could not be verified'; end if;
  if not found then raise exception 'Account profile could not be found'; end if;

  select r.id into v_request_id
    from public.account_deletion_requests r
   where r.user_id = v_user_id and r.status in ('pending', 'in_review')
   order by r.requested_at desc
   limit 1;

  if v_request_id is not null then return v_request_id; end if;

  v_suspended_by_request := v_account_status = 'active';

  insert into public.account_deletion_requests(
    user_id, requested_email, requested_username, source,
    previous_account_status, suspension_applied_by_request
  )
  values (
    v_user_id, v_email, v_username, 'in_app',
    v_account_status, v_suspended_by_request
  )
  returning id into v_request_id;

  insert into public.account_deletion_request_events(request_id, actor_id, action, note)
  values (v_request_id, v_user_id, 'requested_in_app', 'Account deletion requested from app settings.');

  if v_suspended_by_request then
    update public.profiles
       set account_status = 'suspended'
     where id = v_user_id and account_status = 'active';
    if not found then
      raise exception 'Account status changed while the deletion request was being recorded';
    end if;
  end if;

  return v_request_id;
end;
$$;

revoke all on function public.request_my_account_deletion() from public, anon;
grant execute on function public.request_my_account_deletion() to authenticated;

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
  v_current_status text;
begin
  if v_actor is null or not public.has_role(v_actor, 'extreme_admin'::public.app_role) then
    raise exception using errcode = '42501', message = 'Extreme Admin access required';
  end if;
  if p_status not in ('in_review', 'completed', 'rejected') then
    raise exception 'Unsupported deletion-request status';
  end if;
  if p_status = 'completed' and v_note is null then
    raise exception 'A resolution note is required before completing a deletion request';
  elsif v_note is null then
    raise exception 'A verification note is required before changing a deletion request';
  end if;

  select * into v_request
    from public.account_deletion_requests
   where id = p_request_id
   for update;
  if not found then raise exception 'Deletion request not found'; end if;
  if v_request.status in ('completed', 'rejected') then
    raise exception 'A closed deletion request cannot be changed';
  end if;

  if p_status = 'completed' and v_request.user_id is not null then
    raise exception 'The account must be deleted through the supported Auth Admin workflow before this request can be marked complete';
  end if;

  if p_status = 'in_review' and v_request.user_id is not null
     and v_request.status = 'pending' then
    select p.account_status into v_current_status
      from public.profiles p
     where p.id = v_request.user_id
     for update;

    if found then
      if v_request.previous_account_status is null then
        update public.account_deletion_requests
           set previous_account_status = v_current_status,
               suspension_applied_by_request = (v_current_status = 'active')
         where id = p_request_id
         returning * into v_request;
      end if;

      if v_request.suspension_applied_by_request and v_current_status = 'active' then
        update public.profiles
           set account_status = 'suspended'
         where id = v_request.user_id and account_status = 'active';
      end if;
    end if;
  end if;

  if p_status = 'rejected' and v_request.user_id is not null
     and v_request.suspension_applied_by_request
     and v_request.previous_account_status is not null then
    -- Restore only if the profile is still suspended. If a moderator or school
    -- administrator changed it to banned/another state during review, preserve it.
    update public.profiles
       set account_status = v_request.previous_account_status
     where id = v_request.user_id
       and account_status = 'suspended';
  end if;

  update public.account_deletion_requests
     set status = p_status,
         reviewed_at = now(),
         reviewed_by = v_actor,
         resolution_note = v_note
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
