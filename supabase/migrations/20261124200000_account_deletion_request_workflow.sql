-- Safe account deletion requests with a public request path and audited admin processing.
-- User requests never delete auth.users directly. School, financial, parent, and audit
-- dependencies must be transferred or retained before a request can be completed.

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  requester_email text,
  status text not null default 'pending_review'
    check (status in ('pending_review','needs_handover','approved','rejected','cancelled','completed')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  completed_at timestamptz,
  review_note text
);

create unique index if not exists account_deletion_requests_one_open_per_user
  on public.account_deletion_requests(user_id)
  where user_id is not null and status in ('pending_review','needs_handover','approved');

alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from anon, authenticated;
grant select on public.account_deletion_requests to authenticated;

drop policy if exists "Users can view their own deletion requests" on public.account_deletion_requests;
create policy "Users can view their own deletion requests"
  on public.account_deletion_requests for select to authenticated
  using ((select auth.uid()) = user_id);

alter table public.reports
  add column if not exists reporter_anonymized boolean not null default false,
  add column if not exists reported_anonymized boolean not null default false;

alter table public.moderation_actions
  add column if not exists actor_anonymized boolean not null default false,
  add column if not exists target_user_anonymized boolean not null default false;

create or replace function app_private.account_deletion_blockers(p_user_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_blockers text[] := array[]::text[];
begin
  if exists (select 1 from public.school_memberships where user_id = p_user_id) then
    v_blockers := array_append(v_blockers, 'School membership and academic history');
  end if;
  if exists (select 1 from public.schools where created_by = p_user_id) then
    v_blockers := array_append(v_blockers, 'School ownership');
  end if;
  if exists (select 1 from public.school_student_id_reservations where reserved_by = p_user_id or used_by_user_id = p_user_id) then
    v_blockers := array_append(v_blockers, 'Reserved school student IDs');
  end if;
  if exists (select 1 from public.finance_audit_log where actor_id = p_user_id)
     or exists (select 1 from public.finance_budgets where created_by = p_user_id)
     or exists (select 1 from public.finance_invoices where student_id = p_user_id or created_by = p_user_id)
     or exists (select 1 from public.finance_payments where received_by = p_user_id)
     or exists (select 1 from public.finance_transactions where created_by = p_user_id) then
    v_blockers := array_append(v_blockers, 'Financial records and audit history');
  end if;
  if exists (select 1 from public.admin_audit_logs where actor_id = p_user_id) then
    v_blockers := array_append(v_blockers, 'Platform administrator audit history');
  end if;
  if exists (select 1 from public.early_video_resources where reviewed_by = p_user_id) then
    v_blockers := array_append(v_blockers, 'Reviewed learning resources');
  end if;
  if exists (select 1 from public.access_codes where created_by = p_user_id)
     or exists (select 1 from public.announcements where author_id = p_user_id)
     or exists (select 1 from public.chat_groups where created_by = p_user_id)
     or exists (select 1 from public.quizzes where created_by = p_user_id)
     or exists (select 1 from public.study_competitions where created_by = p_user_id)
     or exists (select 1 from public.tournaments where created_by = p_user_id)
     or exists (select 1 from public.flashcards where created_by = p_user_id)
     or exists (select 1 from public.library_books where uploader_id = p_user_id) then
    v_blockers := array_append(v_blockers, 'Shared learning content or groups requiring ownership transfer');
  end if;
  if exists (select 1 from public.parent_links where parent_id = p_user_id or student_id = p_user_id)
     or exists (select 1 from public.parent_goals where student_id = p_user_id)
     or exists (select 1 from public.parent_messages where student_id = p_user_id)
     or exists (select 1 from public.parent_notifications where parent_id = p_user_id or student_id = p_user_id)
     or exists (select 1 from public.parent_tasks where created_by = p_user_id or student_id = p_user_id) then
    v_blockers := array_append(v_blockers, 'Parent and student relationships or records');
  end if;
  if exists (select 1 from public.class_students where student_id = p_user_id)
     or exists (select 1 from public.quiz_assignments where student_id = p_user_id)
     or exists (select 1 from public.quiz_results where student_id = p_user_id) then
    v_blockers := array_append(v_blockers, 'Class enrollment or academic assessment records');
  end if;
  if exists (select 1 from public.school_fee_payments where recorded_by = p_user_id)
     or exists (select 1 from public.school_fee_structures where created_by = p_user_id)
     or exists (select 1 from public.school_finance_audit_events where actor_id = p_user_id)
     or exists (select 1 from public.school_record_events where actor_id = p_user_id)
     or exists (select 1 from public.school_student_invoices where created_by = p_user_id)
     or exists (select 1 from public.school_subjects where created_by = p_user_id)
     or exists (select 1 from public.school_teacher_assignments where created_by = p_user_id)
     or exists (select 1 from public.school_term_results where published_by = p_user_id)
     or exists (select 1 from public.school_networks where created_by = p_user_id) then
    v_blockers := array_append(v_blockers, 'School operations, finance, or audit records');
  end if;

  return v_blockers;
end;
$function$;

revoke all on function app_private.account_deletion_blockers(uuid) from public, anon, authenticated;

create or replace function public.request_my_account_deletion()
returns uuid
language plpgsql
security definer
set search_path = 'public', 'auth'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in with the account you want to delete';
  end if;

  select email into v_email from auth.users where id = v_user_id;
  if v_email is null then
    raise exception 'Account email could not be verified';
  end if;

  select id into v_request_id
  from public.account_deletion_requests
  where user_id = v_user_id
    and status in ('pending_review','needs_handover','approved')
  order by requested_at desc
  limit 1
  for update;

  if v_request_id is not null then
    return v_request_id;
  end if;

  insert into public.account_deletion_requests(user_id, requester_email, status)
  values (v_user_id, lower(v_email), 'pending_review')
  returning id into v_request_id;

  return v_request_id;
end;
$function$;

create or replace function public.get_my_account_deletion_request()
returns table (
  id uuid,
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  completed_at timestamptz,
  review_note text
)
language sql
stable
security definer
set search_path = 'public'
as $function$
  select r.id, r.status, r.requested_at, r.reviewed_at, r.completed_at, r.review_note
  from public.account_deletion_requests r
  where r.user_id = auth.uid()
  order by r.requested_at desc
  limit 1;
$function$;

create or replace function public.cancel_my_account_deletion_request()
returns boolean
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.account_deletion_requests
  set status = 'cancelled', reviewed_at = now(), review_note = 'Cancelled by the account owner'
  where user_id = auth.uid()
    and status in ('pending_review','needs_handover')
  returning id into v_id;

  return v_id is not null;
end;
$function$;

create or replace function public.admin_list_account_deletion_requests(p_limit integer default 100)
returns table (
  id uuid,
  user_id uuid,
  requester_email text,
  display_name text,
  username text,
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  blockers text[]
)
language plpgsql
stable
security definer
set search_path = 'public'
as $function$
begin
  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'manager'::public.app_role)
    or public._is_extreme_admin()
  ) then
    raise exception 'Moderator access required';
  end if;

  return query
  select r.id, r.user_id, r.requester_email, p.name, p.username, r.status,
         r.requested_at, r.reviewed_at, r.review_note,
         case when r.user_id is null then array[]::text[]
              else app_private.account_deletion_blockers(r.user_id) end
  from public.account_deletion_requests r
  left join public.profiles p on p.id = r.user_id
  order by case r.status
    when 'pending_review' then 1
    when 'needs_handover' then 2
    when 'approved' then 3
    when 'rejected' then 4
    when 'cancelled' then 5
    else 6 end,
    r.requested_at asc
  limit greatest(1, least(coalesce(p_limit, 100), 300));
end;
$function$;

create or replace function public.admin_review_account_deletion_request(
  p_request_id uuid,
  p_action text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_request public.account_deletion_requests%rowtype;
  v_blockers text[];
  v_status text;
begin
  if auth.uid() is null or not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'manager'::public.app_role)
    or public._is_extreme_admin()
  ) then
    raise exception 'Moderator access required';
  end if;

  select * into v_request
  from public.account_deletion_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Deletion request not found';
  end if;
  if v_request.status not in ('pending_review','needs_handover') then
    raise exception 'This request is not awaiting review';
  end if;

  if p_action = 'approve' then
    v_blockers := app_private.account_deletion_blockers(v_request.user_id);
    if coalesce(array_length(v_blockers, 1), 0) > 0 then
      v_status := 'needs_handover';
      update public.account_deletion_requests
      set status = v_status, reviewed_at = now(), reviewed_by = auth.uid(),
          review_note = concat_ws('; ', nullif(trim(p_note), ''), 'Handover or retention review required: ', array_to_string(v_blockers, ', '))
      where id = p_request_id;
    else
      v_status := 'approved';
      update public.account_deletion_requests
      set status = v_status, reviewed_at = now(), reviewed_by = auth.uid(),
          review_note = nullif(trim(p_note), '')
      where id = p_request_id;
    end if;
  elsif p_action = 'needs_handover' then
    v_status := 'needs_handover';
    update public.account_deletion_requests
    set status = v_status, reviewed_at = now(), reviewed_by = auth.uid(),
        review_note = nullif(trim(p_note), '')
    where id = p_request_id;
  elsif p_action = 'reject' then
    v_status := 'rejected';
    update public.account_deletion_requests
    set status = v_status, reviewed_at = now(), reviewed_by = auth.uid(),
        review_note = nullif(trim(p_note), '')
    where id = p_request_id;
  else
    raise exception 'Unsupported deletion review action';
  end if;

  insert into public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'review_account_deletion_request', 'account_deletion_request', p_request_id,
          jsonb_build_object('action', p_action, 'status', v_status, 'note', p_note));

  return v_status;
end;
$function$;

create or replace function app_private.delete_account_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth', 'storage'
as $function$
begin
  if coalesce(array_length(app_private.account_deletion_blockers(p_user_id), 1), 0) > 0 then
    raise exception 'School, financial, or audit records require handover before deletion';
  end if;

  delete from storage.objects
  where owner = p_user_id
     or owner_id = p_user_id::text
     or name like p_user_id::text || '/%';

  delete from public.social_post_comments
  where user_id = p_user_id
     or post_id in (select id from public.social_posts where author_id = p_user_id);
  delete from public.social_post_likes where user_id = p_user_id;
  delete from public.social_post_reactions where user_id = p_user_id;
  delete from public.saved_posts where user_id = p_user_id;
  delete from public.social_posts where author_id = p_user_id;

  delete from public.followers where follower_id = p_user_id or following_id = p_user_id;
  delete from public.friends where user_id = p_user_id or friend_id = p_user_id;
  delete from public.messages where sender_id = p_user_id or receiver_id = p_user_id;
  delete from public.group_messages where sender_id = p_user_id;
  delete from public.lobby_messages where user_id = p_user_id;
  delete from public.room_chat_messages where user_id = p_user_id;
  delete from public.multiplayer_invites where sender_id = p_user_id or receiver_id = p_user_id;
  delete from public.chat_group_members where user_id = p_user_id;
  delete from public.room_answers where user_id = p_user_id;
  delete from public.room_players where user_id = p_user_id;
  delete from public.transactions where sender_id = p_user_id or receiver_id = p_user_id;
  delete from public.study_call_participants where user_id = p_user_id or invited_by = p_user_id;
  delete from public.study_call_rooms where created_by = p_user_id;

  delete from public.academic_book_analyses where user_id = p_user_id;
  delete from public.ai_content where user_id = p_user_id;
  delete from public.ai_generated_questions where user_id = p_user_id;
  delete from public.ai_tutor_conversations where user_id = p_user_id;
  delete from public.analytics where user_id = p_user_id;
  delete from public.announcement_reads where user_id = p_user_id;
  delete from public.book_permissions where user_id = p_user_id;
  delete from public.daily_challenge_attempts where user_id = p_user_id;
  delete from public.early_activity_attempts where user_id = p_user_id;
  delete from public.early_activity_progress where user_id = p_user_id;
  delete from public.early_item_exposure where user_id = p_user_id;
  delete from public.early_user_achievements where user_id = p_user_id;
  delete from public.early_user_collection where user_id = p_user_id;
  delete from public.early_video_views where user_id = p_user_id;
  delete from public.edge_request_rate_limits where user_id = p_user_id;
  delete from public.flashcards where user_id = p_user_id;
  delete from public.highlights where user_id = p_user_id;
  delete from public.learning_dna where user_id = p_user_id;
  delete from public.library_bookmarks where user_id = p_user_id;
  delete from public.multiplayer_match_results where user_id = p_user_id;
  delete from public.multiplayer_ranked_stats where user_id = p_user_id;
  delete from public.notification_devices where user_id = p_user_id;
  delete from public.notification_events where user_id = p_user_id;
  delete from public.notification_preferences where user_id = p_user_id;
  delete from public.question_attempts where user_id = p_user_id;
  delete from public.reading_progress where user_id = p_user_id;
  delete from public.revision_schedule where user_id = p_user_id;
  delete from public.study_live_status where user_id = p_user_id;
  delete from public.study_participants where user_id = p_user_id;
  delete from public.study_plans where user_id = p_user_id;
  delete from public.study_sessions where user_id = p_user_id;
  delete from public.study_settings where user_id = p_user_id;
  delete from public.study_tasks where user_id = p_user_id;
  delete from public.topic_progress where user_id = p_user_id;
  delete from public.tournament_participants where user_id = p_user_id;
  delete from public.user_achievements where user_id = p_user_id;
  delete from public.user_currency where user_id = p_user_id;
  delete from public.user_flashcard_progress where user_id = p_user_id;
  delete from public.user_inventory where user_id = p_user_id;
  delete from public.user_items where user_id = p_user_id;
  delete from public.user_missions where user_id = p_user_id;
  delete from public.user_presence where user_id = p_user_id;
  delete from public.user_streaks where user_id = p_user_id;
  delete from public.user_roles where user_id = p_user_id;

  update public.reports
  set reporter_id = '00000000-0000-0000-0000-000000000000',
      reporter_anonymized = true,
      reviewed_by = case when reviewed_by = p_user_id then null else reviewed_by end
  where reporter_id = p_user_id;
  update public.reports
  set reported_id = '00000000-0000-0000-0000-000000000000',
      reported_anonymized = true
  where reported_type = 'user' and reported_id = p_user_id;

  update public.moderation_actions
  set actor_id = case when actor_id = p_user_id then '00000000-0000-0000-0000-000000000000' else actor_id end,
      actor_anonymized = actor_anonymized or actor_id = p_user_id,
      target_id = case when target_type = 'user' and target_id = p_user_id then '00000000-0000-0000-0000-000000000000' else target_id end,
      target_user_id = case when target_user_id = p_user_id then '00000000-0000-0000-0000-000000000000' else target_user_id end,
      target_user_anonymized = target_user_anonymized or target_user_id = p_user_id
  where actor_id = p_user_id or target_user_id = p_user_id or (target_type = 'user' and target_id = p_user_id);

  update public.platform_settings set updated_by = null where updated_by = p_user_id;
  update public.school_memberships set created_by = null where created_by = p_user_id;
  update public.school_networks set created_by = null where created_by = p_user_id;
  update public.school_parent_student_links set linked_by = null where linked_by = p_user_id;

  delete from auth.users where id = p_user_id;
  if not found then
    raise exception 'Account no longer exists';
  end if;
end;
$function$;

revoke all on function app_private.delete_account_data(uuid) from public, anon, authenticated;

create or replace function public.admin_complete_account_deletion_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_request public.account_deletion_requests%rowtype;
  v_blockers text[];
begin
  if auth.uid() is null or not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'manager'::public.app_role)
    or public._is_extreme_admin()
  ) then
    raise exception 'Moderator access required';
  end if;

  select * into v_request
  from public.account_deletion_requests
  where id = p_request_id
  for update;

  if v_request.id is null or v_request.status <> 'approved' or v_request.user_id is null then
    raise exception 'Only approved, active deletion requests can be completed';
  end if;
  if v_request.user_id = auth.uid() then
    raise exception 'A moderator cannot complete their own account deletion request';
  end if;
  if not public._is_extreme_admin()
     and not exists (select 1 from public.user_roles where user_id = v_request.user_id and role = 'student'::public.app_role) then
    raise exception 'Only the Extreme Admin can complete deletion of non-student accounts';
  end if;

  v_blockers := app_private.account_deletion_blockers(v_request.user_id);
  if coalesce(array_length(v_blockers, 1), 0) > 0 then
    update public.account_deletion_requests
    set status = 'needs_handover', reviewed_at = now(),
        review_note = concat('Handover or retention review required: ', array_to_string(v_blockers, ', '))
    where id = p_request_id;
    return false;
  end if;

  begin
    perform app_private.delete_account_data(v_request.user_id);
  exception when foreign_key_violation then
    update public.account_deletion_requests
    set status = 'needs_handover', reviewed_at = now(),
        review_note = 'A linked school, finance, or audit record still references this account. Transfer or retain that record before retrying.'
    where id = p_request_id;
    return false;
  end;

  update public.account_deletion_requests
  set status = 'completed',
      completed_at = now(),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      user_id = null,
      requester_email = null,
      review_note = 'Account data deleted. Required audit records were anonymized or retained.'
  where id = p_request_id;

  insert into public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'complete_account_deletion_request', 'account_deletion_request', p_request_id,
          jsonb_build_object('status', 'completed'));

  return true;
end;
$function$;

-- Legacy client calls are retained for compatibility, but now create a request;
-- they no longer delete invoices or directly remove auth.users.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
begin
  perform public.request_my_account_deletion();
end;
$function$;

revoke all on function public.request_my_account_deletion() from public, anon;
grant execute on function public.request_my_account_deletion() to authenticated;
revoke all on function public.get_my_account_deletion_request() from public, anon;
grant execute on function public.get_my_account_deletion_request() to authenticated;
revoke all on function public.cancel_my_account_deletion_request() from public, anon;
grant execute on function public.cancel_my_account_deletion_request() to authenticated;
revoke all on function public.admin_list_account_deletion_requests(integer) from public, anon;
grant execute on function public.admin_list_account_deletion_requests(integer) to authenticated;
revoke all on function public.admin_review_account_deletion_request(uuid,text,text) from public, anon;
grant execute on function public.admin_review_account_deletion_request(uuid,text,text) to authenticated;
revoke all on function public.admin_complete_account_deletion_request(uuid) from public, anon;
grant execute on function public.admin_complete_account_deletion_request(uuid) to authenticated;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
