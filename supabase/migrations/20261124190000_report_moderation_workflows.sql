-- Moderation workflow with auditable, reversible content removal.
alter table public.reports
  add column if not exists moderation_action text,
  add column if not exists moderation_note text;

alter table public.social_posts
  add column if not exists moderation_status text not null default 'visible',
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid,
  add column if not exists moderation_reason text;
alter table public.social_post_comments
  add column if not exists moderation_status text not null default 'visible',
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid,
  add column if not exists moderation_reason text;
alter table public.messages
  add column if not exists moderation_status text not null default 'visible',
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid,
  add column if not exists moderation_reason text;
alter table public.group_messages
  add column if not exists moderation_status text not null default 'visible',
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid,
  add column if not exists moderation_reason text;
alter table public.lobby_messages
  add column if not exists moderation_status text not null default 'visible',
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid,
  add column if not exists moderation_reason text;
alter table public.room_chat_messages
  add column if not exists moderation_status text not null default 'visible',
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid,
  add column if not exists moderation_reason text;

alter table public.social_posts
  drop constraint if exists social_posts_moderation_status_check;
alter table public.social_posts
  add constraint social_posts_moderation_status_check check (moderation_status in ('visible','removed'));
alter table public.social_post_comments
  drop constraint if exists social_post_comments_moderation_status_check;
alter table public.social_post_comments
  add constraint social_post_comments_moderation_status_check check (moderation_status in ('visible','removed'));
alter table public.messages
  drop constraint if exists messages_moderation_status_check;
alter table public.messages
  add constraint messages_moderation_status_check check (moderation_status in ('visible','removed'));
alter table public.group_messages
  drop constraint if exists group_messages_moderation_status_check;
alter table public.group_messages
  add constraint group_messages_moderation_status_check check (moderation_status in ('visible','removed'));
alter table public.lobby_messages
  drop constraint if exists lobby_messages_moderation_status_check;
alter table public.lobby_messages
  add constraint lobby_messages_moderation_status_check check (moderation_status in ('visible','removed'));
alter table public.room_chat_messages
  drop constraint if exists room_chat_messages_moderation_status_check;
alter table public.room_chat_messages
  add constraint room_chat_messages_moderation_status_check check (moderation_status in ('visible','removed'));

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete restrict,
  actor_id uuid not null,
  action text not null check (action in ('resolved','dismissed','content_removed','user_suspended')),
  target_type text not null,
  target_id uuid not null,
  target_user_id uuid,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.moderation_actions enable row level security;
revoke all on public.moderation_actions from anon, authenticated;
grant select on public.moderation_actions to authenticated;
drop policy if exists "moderators can view moderation actions" on public.moderation_actions;
create policy "moderators can view moderation actions"
  on public.moderation_actions for select to authenticated
  using (
    has_role((select auth.uid()), 'admin'::public.app_role)
    or has_role((select auth.uid()), 'manager'::public.app_role)
    or (select public._is_extreme_admin())
  );

-- Hide content that has been removed, while leaving a report trail for review.
drop policy if exists "users can view opted-in posts excluding blocked authors" on public.social_posts;
create policy "users can view opted-in posts excluding blocked authors"
  on public.social_posts for select to authenticated
  using (
    (
      moderation_status = 'visible'
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
    )
    and (
      author_id = (select auth.uid())
      or coalesce((select p.is_public from public.profile_privacy_settings p where p.user_id = social_posts.author_id), true)
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
    )
    and (
      author_id = (select auth.uid())
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
      or not app_private.is_user_blocked(author_id, (select auth.uid()))
    )
  );

drop policy if exists "users can view visible comments excluding blocked authors" on public.social_post_comments;
create policy "users can view visible comments excluding blocked authors"
  on public.social_post_comments for select to authenticated
  using (
    (
      moderation_status = 'visible'
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
    )
    and not app_private.is_user_blocked(user_id, (select auth.uid()))
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_comments.post_id
        and (
          p.author_id = (select auth.uid())
          or coalesce((select s.is_public from public.profile_privacy_settings s where s.user_id = p.author_id), true)
          or has_role((select auth.uid()), 'admin'::public.app_role)
          or has_role((select auth.uid()), 'manager'::public.app_role)
          or (select public._is_extreme_admin())
        )
    )
  );

drop policy if exists "involved users can view unblocked messages" on public.messages;
create policy "involved users can view unblocked messages"
  on public.messages for select to authenticated
  using (
    (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
    and (
      moderation_status = 'visible'
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
    )
    and not app_private.is_user_blocked(sender_id, receiver_id)
  );

drop policy if exists "members can view group messages excluding blocked senders" on public.group_messages;
create policy "members can view group messages excluding blocked senders"
  on public.group_messages for select to authenticated
  using (
    exists (
      select 1 from public.chat_group_members m
      where m.group_id = group_messages.group_id
        and m.user_id = (select auth.uid())
    )
    and (
      moderation_status = 'visible'
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
    )
    and not app_private.is_user_blocked(sender_id, (select auth.uid()))
  );

drop policy if exists "authenticated can view unblocked lobby messages" on public.lobby_messages;
create policy "authenticated can view unblocked lobby messages"
  on public.lobby_messages for select to authenticated
  using (
    (
      moderation_status = 'visible'
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
    )
    and not app_private.is_user_blocked(user_id, (select auth.uid()))
  );

drop policy if exists "room members can view unblocked room chat" on public.room_chat_messages;
create policy "room members can view unblocked room chat"
  on public.room_chat_messages for select to authenticated
  using (
    is_multiplayer_room_member(room_id)
    and (
      moderation_status = 'visible'
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
    )
    and not app_private.is_user_blocked(user_id, (select auth.uid()))
  );

create or replace function public.admin_list_reports(p_limit integer default 200)
returns table (
  id uuid,
  reporter_id uuid,
  reporter_name text,
  reported_id uuid,
  reported_name text,
  reported_type text,
  reason text,
  description text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  content_preview text,
  moderation_action text
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
  select
    r.id,
    r.reporter_id,
    reporter.name,
    r.reported_id,
    case
      when r.reported_type = 'user' then target_profile.name
      when r.reported_type = 'post' then post_author.name
      when r.reported_type = 'comment' then comment_author.name
      when r.reported_type = 'message' then message_author.name
      when r.reported_type = 'group_message' then group_author.name
      when r.reported_type = 'lobby_message' then lobby_author.name
      when r.reported_type = 'room_message' then room_author.name
      when r.reported_type = 'group_message' then coalesce(group_message.content, 'Group message unavailable')
      when r.reported_type = 'lobby_message' then coalesce(lobby_message.content, 'Lobby message unavailable')
      when r.reported_type = 'room_message' then coalesce(room_message.content, 'Room message unavailable')
      else null
    end,
    r.reported_type,
    r.reason,
    r.description,
    r.status,
    r.created_at,
    r.reviewed_at,
    r.reviewed_by,
    case
      when r.reported_type = 'post' then left(coalesce(post.content, ''), 500)
      when r.reported_type = 'comment' then left(coalesce(comment_row.content, ''), 500)
      when r.reported_type = 'message' then left(coalesce(message_row.content, ''), 500)
      when r.reported_type = 'group_message' then left(coalesce(group_message.content, ''), 500)
      when r.reported_type = 'lobby_message' then left(coalesce(lobby_message.content, ''), 500)
      when r.reported_type = 'room_message' then left(coalesce(room_message.content, ''), 500)
      else null
    end,
    r.moderation_action
  from public.reports r
  left join public.profiles reporter on reporter.id = r.reporter_id
  left join public.profiles target_profile on target_profile.id = r.reported_id
  left join public.social_posts post on post.id = r.reported_id and r.reported_type = 'post'
  left join public.profiles post_author on post_author.id = post.author_id
  left join public.social_post_comments comment_row on comment_row.id = r.reported_id and r.reported_type = 'comment'
  left join public.profiles comment_author on comment_author.id = comment_row.user_id
  left join public.messages message_row on message_row.id = r.reported_id and r.reported_type = 'message'
  left join public.profiles message_author on message_author.id = message_row.sender_id
  left join public.group_messages group_message on group_message.id = r.reported_id and r.reported_type = 'group_message'
  left join public.profiles group_author on group_author.id = group_message.sender_id
  left join public.lobby_messages lobby_message on lobby_message.id = r.reported_id and r.reported_type = 'lobby_message'
  left join public.profiles lobby_author on lobby_author.id = lobby_message.user_id
  left join public.room_chat_messages room_message on room_message.id = r.reported_id and r.reported_type = 'room_message'
  left join public.profiles room_author on room_author.id = room_message.user_id
  order by (r.reason = 'child_safety') desc, r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$function$;

create or replace function public.moderate_report(
  p_report_id uuid,
  p_action text,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_report public.reports%rowtype;
  v_target_user uuid;
  v_reason text;
begin
  if auth.uid() is null or not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'manager'::public.app_role)
    or public._is_extreme_admin()
  ) then
    raise exception 'Moderator access required';
  end if;

  select * into v_report
  from public.reports
  where id = p_report_id
  for update;

  if v_report.id is null then
    raise exception 'Report not found';
  end if;
  if v_report.status <> 'pending' then
    raise exception 'Only pending reports can be actioned';
  end if;

  v_reason := coalesce(nullif(trim(p_reason), ''), v_report.reason);

  if p_action = 'dismiss' then
    update public.reports
    set status = 'dismissed', reviewed_by = auth.uid(), reviewed_at = now(),
        moderation_action = 'dismissed', moderation_note = v_reason
    where id = p_report_id;
    insert into public.moderation_actions(report_id, actor_id, action, target_type, target_id, reason)
    values (p_report_id, auth.uid(), 'dismissed', v_report.reported_type, v_report.reported_id, v_reason);

  elsif p_action = 'resolve' then
    update public.reports
    set status = 'resolved', reviewed_by = auth.uid(), reviewed_at = now(),
        moderation_action = 'resolved', moderation_note = v_reason
    where id = p_report_id;
    insert into public.moderation_actions(report_id, actor_id, action, target_type, target_id, reason)
    values (p_report_id, auth.uid(), 'resolved', v_report.reported_type, v_report.reported_id, v_reason);

  elsif p_action = 'remove_content' then
    if v_report.reported_type = 'post' then
      update public.social_posts
      set moderation_status = 'removed', moderated_at = now(), moderated_by = auth.uid(), moderation_reason = v_reason
      where id = v_report.reported_id;
      select author_id into v_target_user from public.social_posts where id = v_report.reported_id;
    elsif v_report.reported_type = 'comment' then
      update public.social_post_comments
      set moderation_status = 'removed', moderated_at = now(), moderated_by = auth.uid(), moderation_reason = v_reason
      where id = v_report.reported_id;
      select user_id into v_target_user from public.social_post_comments where id = v_report.reported_id;
    elsif v_report.reported_type = 'message' then
      update public.messages
      set moderation_status = 'removed', moderated_at = now(), moderated_by = auth.uid(), moderation_reason = v_reason
      where id = v_report.reported_id;
      select sender_id into v_target_user from public.messages where id = v_report.reported_id;
    elsif v_report.reported_type = 'group_message' then
      update public.group_messages
      set moderation_status = 'removed', moderated_at = now(), moderated_by = auth.uid(), moderation_reason = v_reason
      where id = v_report.reported_id;
      select sender_id into v_target_user from public.group_messages where id = v_report.reported_id;
    elsif v_report.reported_type = 'lobby_message' then
      update public.lobby_messages
      set moderation_status = 'removed', moderated_at = now(), moderated_by = auth.uid(), moderation_reason = v_reason
      where id = v_report.reported_id;
      select user_id into v_target_user from public.lobby_messages where id = v_report.reported_id;
    elsif v_report.reported_type = 'room_message' then
      update public.room_chat_messages
      set moderation_status = 'removed', moderated_at = now(), moderated_by = auth.uid(), moderation_reason = v_reason
      where id = v_report.reported_id;
      select user_id into v_target_user from public.room_chat_messages where id = v_report.reported_id;
    else
      raise exception 'This report type does not reference removable content';
    end if;

    if not found and v_target_user is null then
      raise exception 'Reported content not found';
    end if;

    update public.reports
    set status = 'resolved', reviewed_by = auth.uid(), reviewed_at = now(),
        moderation_action = 'content_removed', moderation_note = v_reason
    where id = p_report_id;
    insert into public.moderation_actions(report_id, actor_id, action, target_type, target_id, target_user_id, reason)
    values (p_report_id, auth.uid(), 'content_removed', v_report.reported_type, v_report.reported_id, v_target_user, v_reason);

  elsif p_action = 'suspend_user' then
    if v_report.reported_type <> 'user' then
      raise exception 'Only user reports can suspend an account';
    end if;
    v_target_user := v_report.reported_id;

    if public._is_extreme_admin() then
      perform public.extreme_admin_set_user_status(v_target_user, 'suspended', v_reason);
    elsif exists (
      select 1 from public.user_roles
      where user_id = v_target_user and role = 'student'::public.app_role
    ) then
      perform public.manager_set_student_status(v_target_user, 'suspended', v_reason);
    else
      raise exception 'Only the Extreme Admin can suspend non-student accounts';
    end if;

    update public.reports
    set status = 'resolved', reviewed_by = auth.uid(), reviewed_at = now(),
        moderation_action = 'user_suspended', moderation_note = v_reason
    where id = p_report_id;
    insert into public.moderation_actions(report_id, actor_id, action, target_type, target_id, target_user_id, reason)
    values (p_report_id, auth.uid(), 'user_suspended', 'user', v_target_user, v_target_user, v_reason);

  else
    raise exception 'Unsupported moderation action';
  end if;

  insert into public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  values (
    auth.uid(),
    'moderate_user_report',
    'report',
    p_report_id,
    jsonb_build_object('action', p_action, 'reason', v_reason, 'reported_type', v_report.reported_type, 'reported_id', v_report.reported_id)
  );

  return true;
end;
$function$;

revoke all on function public.admin_list_reports(integer) from public, anon;
grant execute on function public.admin_list_reports(integer) to authenticated;
revoke all on function public.moderate_report(uuid, text, text) from public, anon;
grant execute on function public.moderate_report(uuid, text, text) to authenticated;
