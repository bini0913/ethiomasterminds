-- Moderation actions are server-authoritative and auditable.
create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  action text not null check (action in ('resolve', 'dismiss', 'remove_content', 'suspend_user', 'ban_user')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists moderation_actions_report_id_idx
  on public.moderation_actions (report_id, created_at desc);
create index if not exists moderation_actions_target_idx
  on public.moderation_actions (target_type, target_id, created_at desc);

alter table public.moderation_actions enable row level security;
revoke all on public.moderation_actions from anon, authenticated;
grant select on public.moderation_actions to authenticated;

drop policy if exists "Platform moderators can view moderation actions" on public.moderation_actions;
create policy "Platform moderators can view moderation actions"
  on public.moderation_actions for select to authenticated
  using (
    has_role((select auth.uid()), 'admin'::app_role)
    or has_role((select auth.uid()), 'extreme_admin'::app_role)
  );

-- Make account-status changes visible to active sessions immediately.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'profiles'
     ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;

create index if not exists reports_reporter_created_idx
  on public.reports (reporter_id, created_at desc);
create index if not exists reports_pending_created_idx
  on public.reports (created_at desc)
  where status = 'pending';
create unique index if not exists reports_one_pending_per_reporter_item
  on public.reports (reporter_id, reported_type, reported_id)
  where status = 'pending';

create or replace function public.enforce_report_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_recent_count integer;
  v_target_exists boolean := false;
begin
  if auth.uid() is null or new.reporter_id is null or new.reporter_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'You can only submit a report from your own account';
  end if;
  if new.reported_id is null or new.reported_id = new.reporter_id then
    raise exception 'Choose content or another account to report';
  end if;

  select count(*)::integer into v_recent_count
    from public.reports r
   where r.reporter_id = new.reporter_id
     and r.created_at > now() - interval '1 hour';
  if v_recent_count >= 10 then raise exception 'You have reached the hourly report limit. Try again later.'; end if;

  if exists (
    select 1 from public.reports r
    where r.reporter_id = new.reporter_id
      and r.reported_id = new.reported_id
      and r.reported_type = new.reported_type
      and r.status = 'pending'
  ) then raise exception 'You already have a pending report for this item'; end if;

  case new.reported_type
    when 'user' then
      select exists(select 1 from public.profiles p where p.id = new.reported_id) into v_target_exists;
    when 'post' then
      select exists(select 1 from public.social_posts p where p.id = new.reported_id) into v_target_exists;
    when 'comment' then
      select exists(select 1 from public.social_post_comments c where c.id = new.reported_id) into v_target_exists;
    when 'message' then
      select exists(select 1 from public.messages m where m.id = new.reported_id) into v_target_exists;
    when 'group_message' then
      select exists(select 1 from public.group_messages m where m.id = new.reported_id) into v_target_exists;
    when 'lobby_message' then
      select exists(select 1 from public.lobby_messages m where m.id = new.reported_id) into v_target_exists;
    when 'room_message' then
      select exists(select 1 from public.room_chat_messages m where m.id = new.reported_id) into v_target_exists;
    else
      raise exception 'Unsupported report type';
  end case;

  if not coalesce(v_target_exists, false) then raise exception 'The reported item is no longer available'; end if;
  new.status := 'pending';
  new.created_at := coalesce(new.created_at, now());
  return new;
end;
$$;

drop trigger if exists enforce_report_submission_guard on public.reports;
create trigger enforce_report_submission_guard
  before insert on public.reports
  for each row execute function public.enforce_report_submission();
revoke all on function public.enforce_report_submission() from public, anon, authenticated;

drop policy if exists "admins manage reports" on public.reports;
drop policy if exists "reporter can view own reports" on public.reports;
create policy "reporter and platform admins can view reports"
  on public.reports for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
    or public.has_role((select auth.uid()), 'extreme_admin'::public.app_role)
  );

-- Report status and enforcement changes must pass through the audited RPC.
revoke update on public.reports from authenticated;

create or replace function public.moderation_get_report_context(p_report_ids uuid[])
returns table(report_id uuid, reported_content text)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not (
    public.has_role(v_actor, 'admin'::public.app_role)
    or public.has_role(v_actor, 'extreme_admin'::public.app_role)
  ) then
    raise exception using errcode = '42501', message = 'You are not authorised to view moderation context';
  end if;

  return query
  select
    r.id,
    case r.reported_type
      when 'user' then coalesce(
        (select concat_ws(' ', p.name, case when p.username is not null then concat('@', p.username) end)
           from public.profiles p where p.id = r.reported_id),
        'Reported account is unavailable'
      )
      when 'post' then coalesce(
        (select left(p.content, 500) from public.social_posts p where p.id = r.reported_id),
        'Reported content is no longer available'
      )
      when 'comment' then coalesce(
        (select left(c.content, 500) from public.social_post_comments c where c.id = r.reported_id),
        'Reported content is no longer available'
      )
      when 'message' then coalesce(
        (select left(m.content, 500) from public.messages m where m.id = r.reported_id),
        'Reported content is no longer available'
      )
      when 'group_message' then coalesce(
        (select left(m.content, 500) from public.group_messages m where m.id = r.reported_id),
        'Reported content is no longer available'
      )
      when 'lobby_message' then coalesce(
        (select left(m.content, 500) from public.lobby_messages m where m.id = r.reported_id),
        'Reported content is no longer available'
      )
      when 'room_message' then coalesce(
        (select left(m.content, 500) from public.room_chat_messages m where m.id = r.reported_id),
        'Reported content is no longer available'
      )
      else 'No preview is available for this report type'
    end
  from public.reports r
  where r.id = any(coalesce(p_report_ids, array[]::uuid[]));
end;
$$;

revoke all on function public.moderation_get_report_context(uuid[]) from public, anon;
grant execute on function public.moderation_get_report_context(uuid[]) to authenticated;

create or replace function public.moderate_user_report(
  p_report_id uuid,
  p_action text,
  p_reason text default null
)
returns public.reports
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_report public.reports%rowtype;
  v_new_status text;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 1000), '');
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if not (
    public.has_role(v_actor, 'admin'::public.app_role)
    or public.has_role(v_actor, 'extreme_admin'::public.app_role)
  ) then
    raise exception using errcode = '42501', message = 'You are not authorised to moderate reports';
  end if;

  select * into v_report
    from public.reports
   where id = p_report_id
   for update;
  if not found then raise exception 'Report not found'; end if;
  if v_report.status <> 'pending' then raise exception 'This report has already been reviewed'; end if;

  case p_action
    when 'resolve' then
      v_new_status := 'resolved';
    when 'dismiss' then
      v_new_status := 'dismissed';
    when 'remove_content' then
      case v_report.reported_type
        when 'post' then
          delete from public.social_posts where id = v_report.reported_id;
        when 'comment' then
          delete from public.social_post_comments where id = v_report.reported_id;
        when 'message' then
          delete from public.messages where id = v_report.reported_id;
        when 'group_message' then
          delete from public.group_messages where id = v_report.reported_id;
        when 'lobby_message' then
          delete from public.lobby_messages where id = v_report.reported_id;
        when 'room_message' then
          delete from public.room_chat_messages where id = v_report.reported_id;
        else
          raise exception 'This report type does not support content removal';
      end case;
      v_new_status := 'resolved';
    when 'suspend_user' then
      if v_report.reported_type <> 'user' then raise exception 'Only user reports can suspend an account'; end if;
      update public.profiles set account_status = 'suspended' where id = v_report.reported_id;
      if not found then raise exception 'Reported account was not found'; end if;
      v_new_status := 'resolved';
    when 'ban_user' then
      if v_report.reported_type <> 'user' then raise exception 'Only user reports can ban an account'; end if;
      update public.profiles set account_status = 'banned' where id = v_report.reported_id;
      if not found then raise exception 'Reported account was not found'; end if;
      v_new_status := 'resolved';
    else
      raise exception 'Unsupported moderation action';
  end case;

  insert into public.moderation_actions(report_id, actor_id, target_type, target_id, action, reason)
  values (v_report.id, v_actor, v_report.reported_type, v_report.reported_id, p_action, v_reason);

  update public.reports
     set status = v_new_status,
         reviewed_by = v_actor,
         reviewed_at = now()
   where id = v_report.id
   returning * into v_report;

  return v_report;
end;
$$;

revoke all on function public.moderate_user_report(uuid, text, text) from public, anon;
grant execute on function public.moderate_user_report(uuid, text, text) to authenticated;

comment on table public.moderation_actions is 'Append-only audit of report reviews, content removal and account enforcement actions.';
