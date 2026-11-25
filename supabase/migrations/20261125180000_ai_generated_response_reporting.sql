-- Allow learners to report unsafe or inappropriate AI-generated responses.
-- The response snapshot is private evidence, never directly exposed through the Data API.

create table if not exists public.ai_response_report_evidence (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('ai_tutor', 'ai_helper')),
  conversation_id uuid references public.ai_tutor_conversations(id) on delete set null,
  response_text text not null check (char_length(response_text) between 1 and 12000),
  created_at timestamptz not null default now(),
  constraint ai_response_report_evidence_source_conversation_check
    check (
      (source = 'ai_tutor' and conversation_id is not null)
      or (source = 'ai_helper' and conversation_id is null)
    )
);

create index if not exists ai_response_report_evidence_reporter_created_idx
  on public.ai_response_report_evidence (reporter_id, created_at desc);

alter table public.ai_response_report_evidence enable row level security;
revoke all on public.ai_response_report_evidence from public, anon, authenticated;

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
    when 'ai_response' then
      select exists(
        select 1 from public.ai_response_report_evidence e
        where e.id = new.reported_id and e.reporter_id = new.reporter_id
      ) into v_target_exists;
    else
      raise exception 'Unsupported report type';
  end case;

  if not coalesce(v_target_exists, false) then raise exception 'The reported item is no longer available'; end if;
  new.status := 'pending';
  new.created_at := coalesce(new.created_at, now());
  return new;
end;
$$;

revoke all on function public.enforce_report_submission() from public, anon, authenticated;

create or replace function public.submit_ai_response_report(
  p_source text,
  p_response_text text,
  p_reason text,
  p_description text default null,
  p_conversation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_reporter uuid := auth.uid();
  v_evidence_id uuid;
  v_report_id uuid;
  v_response text := left(trim(coalesce(p_response_text, '')), 12000);
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_reporter is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_source not in ('ai_tutor', 'ai_helper') then
    raise exception 'Unsupported AI response source';
  end if;
  if v_response = '' then raise exception 'The AI response is empty'; end if;
  if v_reason not in ('inappropriate', 'harassment', 'violence', 'misinformation', 'privacy', 'other') then
    raise exception 'Choose a valid report reason';
  end if;

  if p_source = 'ai_tutor' then
    if p_conversation_id is null or not exists (
      select 1 from public.ai_tutor_conversations c
      where c.id = p_conversation_id and c.user_id = v_reporter
    ) then
      raise exception using errcode = '42501', message = 'The AI Tutor conversation does not belong to your account';
    end if;
  elsif p_conversation_id is not null then
    raise exception 'AI Helper reports cannot reference an AI Tutor conversation';
  end if;

  insert into public.ai_response_report_evidence(
    reporter_id, source, conversation_id, response_text
  ) values (
    v_reporter, p_source, p_conversation_id, v_response
  ) returning id into v_evidence_id;

  insert into public.reports(
    reporter_id, reported_type, reported_id, reason, description, status, created_at
  ) values (
    v_reporter,
    'ai_response',
    v_evidence_id,
    v_reason,
    nullif(left(trim(coalesce(p_description, '')), 1000), ''),
    'pending',
    now()
  ) returning id into v_report_id;

  return v_report_id;
end;
$$;

revoke all on function public.submit_ai_response_report(text, text, text, text, uuid) from public, anon;
grant execute on function public.submit_ai_response_report(text, text, text, text, uuid) to authenticated;

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
        (select left(a.content_snapshot ->> 'content', 500) from public.moderation_content_archive a where a.report_id = r.id),
        'Reported content is no longer available'
      )
      when 'comment' then coalesce(
        (select left(c.content, 500) from public.social_post_comments c where c.id = r.reported_id),
        (select left(a.content_snapshot ->> 'content', 500) from public.moderation_content_archive a where a.report_id = r.id),
        'Reported content is no longer available'
      )
      when 'message' then coalesce(
        (select left(m.content, 500) from public.messages m where m.id = r.reported_id),
        (select left(a.content_snapshot ->> 'content', 500) from public.moderation_content_archive a where a.report_id = r.id),
        'Reported content is no longer available'
      )
      when 'group_message' then coalesce(
        (select left(m.content, 500) from public.group_messages m where m.id = r.reported_id),
        (select left(a.content_snapshot ->> 'content', 500) from public.moderation_content_archive a where a.report_id = r.id),
        'Reported content is no longer available'
      )
      when 'lobby_message' then coalesce(
        (select left(m.content, 500) from public.lobby_messages m where m.id = r.reported_id),
        (select left(a.content_snapshot ->> 'content', 500) from public.moderation_content_archive a where a.report_id = r.id),
        'Reported content is no longer available'
      )
      when 'room_message' then coalesce(
        (select left(m.content, 500) from public.room_chat_messages m where m.id = r.reported_id),
        (select left(a.content_snapshot ->> 'content', 500) from public.moderation_content_archive a where a.report_id = r.id),
        'Reported content is no longer available'
      )
      when 'ai_response' then coalesce(
        (select left(e.response_text, 500) from public.ai_response_report_evidence e where e.id = r.reported_id),
        'Reported AI response is no longer available'
      )
      else 'No preview is available for this report type'
    end
  from public.reports r
  where r.id = any(coalesce(p_report_ids, array[]::uuid[]));
end;
$$;

revoke all on function public.moderation_get_report_context(uuid[]) from public, anon;
grant execute on function public.moderation_get_report_context(uuid[]) to authenticated;

comment on table public.ai_response_report_evidence is
  'Private snapshots of AI-generated responses submitted for moderation review; accessible only through the moderator context RPC.';
