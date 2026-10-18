-- Complete Study Mode reliability, server-authoritative time, statistics and permissions.
-- Safe additive migration: preserves existing study history and the current Supabase project.

alter table public.profiles
  add column if not exists total_study_time integer not null default 0;

alter table public.study_sessions
  add column if not exists paused_at timestamptz,
  add column if not exists paused_seconds integer not null default 0;

create index if not exists idx_study_sessions_user_status_end
  on public.study_sessions (user_id, status, end_time desc);

-- The live schema is missing these uniqueness constraints; add them before using ON CONFLICT.
create unique index if not exists idx_study_participants_competition_user
  on public.study_participants (competition_id, user_id);

create unique index if not exists idx_study_sessions_one_active_per_user
  on public.study_sessions (user_id)
  where status = 'active';

-- Only authenticated users can start their own session through this RPC.
create or replace function public.start_study_session(
  p_competition_id uuid default null,
  p_mode text default 'pomodoro',
  p_planned_duration integer default 25
) returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.study_sessions;
  v_mode text := coalesce(nullif(trim(p_mode), ''), 'pomodoro');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_planned_duration < 5 or p_planned_duration > 180 then
    raise exception 'Planned duration must be between 5 and 180 minutes';
  end if;
  if v_mode not in ('pomodoro', 'deep', 'custom') then
    raise exception 'Invalid study mode';
  end if;
  if exists (
    select 1 from public.study_sessions
    where user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'You already have an active study session';
  end if;
  if p_competition_id is not null and not exists (
    select 1 from public.study_competitions
    where id = p_competition_id and status = 'active'
      and (end_time is null or end_time > now())
  ) then
    raise exception 'Selected competition is not active';
  end if;
  if p_competition_id is not null and not exists (
    select 1 from public.study_participants
    where competition_id = p_competition_id and user_id = auth.uid()
  ) then
    raise exception 'Join the selected competition before starting a session';
  end if;

  insert into public.study_sessions (
    user_id, competition_id, mode, planned_duration, status, start_time, paused_at, paused_seconds
  ) values (
    auth.uid(), p_competition_id, v_mode, p_planned_duration, 'active', now(), null, 0
  ) returning * into v_session;

  insert into public.study_live_status as live (
    user_id, is_studying, current_session_start, updated_at
  ) values (
    auth.uid(), true, v_session.start_time, now()
  )
  on conflict (user_id) do update set
    is_studying = true,
    current_session_start = excluded.current_session_start,
    updated_at = now();

  return v_session;
end;
$$;

revoke all on function public.start_study_session(uuid, text, integer) from public, anon;
grant execute on function public.start_study_session(uuid, text, integer) to authenticated;

create or replace function public.pause_study_session(p_session_id uuid)
returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.study_sessions;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_session from public.study_sessions
    where id = p_session_id and user_id = auth.uid() and status = 'active'
    for update;
  if not found then raise exception 'Active study session not found'; end if;
  if v_session.paused_at is null then
    update public.study_sessions set paused_at = now()
      where id = p_session_id returning * into v_session;
  end if;
  update public.study_live_status set is_studying = true, updated_at = now()
    where user_id = auth.uid();
  return v_session;
end;
$$;

create or replace function public.resume_study_session(p_session_id uuid)
returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.study_sessions;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_session from public.study_sessions
    where id = p_session_id and user_id = auth.uid() and status = 'active'
    for update;
  if not found then raise exception 'Active study session not found'; end if;
  if v_session.paused_at is not null then
    update public.study_sessions
      set paused_seconds = coalesce(paused_seconds, 0) + greatest(0, floor(extract(epoch from (now() - paused_at)))::integer),
          paused_at = null
      where id = p_session_id returning * into v_session;
  end if;
  update public.study_live_status set is_studying = true, updated_at = now()
    where user_id = auth.uid();
  return v_session;
end;
$$;

create or replace function public.heartbeat_study_presence(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.study_sessions
    where id = p_session_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'Active study session not found';
  end if;
  insert into public.study_live_status as live (
    user_id, is_studying, current_session_start, updated_at
  )
  select auth.uid(), true, ss.start_time, now()
  from public.study_sessions ss where ss.id = p_session_id
  on conflict (user_id) do update set
    is_studying = true,
    current_session_start = excluded.current_session_start,
    updated_at = now();
end;
$$;

create or replace function public.complete_study_session(
  p_session_id uuid,
  p_duration_override integer default null,
  p_task_id uuid default null,
  p_mark_task_complete boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_session public.study_sessions;
  v_active_seconds numeric;
  v_minutes integer;
  v_xp integer;
  v_coins integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_session
  from public.study_sessions
  where id = p_session_id and user_id = v_uid
  for update;

  if not found then raise exception 'Study session not found'; end if;
  if v_session.status = 'completed' then
    return jsonb_build_object(
      'session_id', v_session.id, 'duration', v_session.duration,
      'xp_earned', 0, 'coins_earned', 0, 'already_completed', true
    );
  end if;
  if v_session.status <> 'active' then raise exception 'Study session is not active'; end if;

  v_active_seconds := greatest(
    0,
    extract(epoch from (v_now - v_session.start_time))
      - coalesce(v_session.paused_seconds, 0)
      - case when v_session.paused_at is not null
          then greatest(0, extract(epoch from (v_now - v_session.paused_at)))
          else 0 end
  );
  if v_active_seconds < 60 then
    raise exception 'Study for at least one active minute before completing a session';
  end if;

  -- Duration is computed from server timestamps; client-supplied overrides are intentionally ignored.
  v_minutes := least(
    greatest(5, coalesce(v_session.planned_duration, 25)),
    greatest(1, ceil(v_active_seconds / 60.0)::integer)
  );
  v_xp := v_minutes * 10;
  v_coins := v_minutes;

  update public.study_sessions
    set end_time = v_now, duration = v_minutes, status = 'completed',
        paused_at = null
    where id = v_session.id;

  if p_mark_task_complete and p_task_id is not null then
    update public.study_tasks set completed = true
      where id = p_task_id and user_id = v_uid;
  end if;

  if v_session.competition_id is not null then
    update public.study_participants sp
      set total_study_time = coalesce(sp.total_study_time, 0) + v_minutes
      from public.study_competitions sc
      where sp.competition_id = sc.id
        and sp.competition_id = v_session.competition_id
        and sp.user_id = v_uid
        and sc.status = 'active'
        and sc.start_time <= v_now
        and (sc.end_time is null or sc.end_time >= v_now);
  end if;

  update public.profiles
    set total_study_time = coalesce(total_study_time, 0) + v_minutes,
        xp = coalesce(xp, 0) + v_xp,
        season_xp = coalesce(season_xp, 0) + v_xp,
        updated_at = v_now
    where id = v_uid;

  update public.user_currency
    set coins = coalesce(coins, 0) + v_coins, updated_at = v_now
    where user_id = v_uid;

  insert into public.study_live_status as live (
    user_id, is_studying, current_session_start, updated_at
  ) values (v_uid, false, null, v_now)
  on conflict (user_id) do update set
    is_studying = false, current_session_start = null, updated_at = v_now;

  return jsonb_build_object(
    'session_id', v_session.id, 'duration', v_minutes,
    'xp_earned', v_xp, 'coins_earned', v_coins, 'already_completed', false
  );
end;
$$;

revoke all on function public.complete_study_session(uuid, integer, uuid, boolean) from public, anon;
grant execute on function public.complete_study_session(uuid, integer, uuid, boolean) to authenticated;
revoke all on function public.complete_study_session(uuid) from public, anon, authenticated;

create or replace function public.create_study_competition(p_name text)
returns public.study_competitions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.study_competitions;
  v_name text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(v_name) < 3 or length(v_name) > 80 then
    raise exception 'Competition name must be between 3 and 80 characters';
  end if;

  insert into public.study_competitions (name, created_by, start_time, end_time, status)
  values (v_name, auth.uid(), now(), now() + interval '24 hours', 'active')
  returning * into v_competition;

  insert into public.study_participants (competition_id, user_id, total_study_time)
  values (v_competition.id, auth.uid(), 0)
  on conflict (competition_id, user_id) do nothing;

  return v_competition;
end;
$$;

create or replace function public.join_study_competition(p_competition_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.study_competitions
    where id = p_competition_id and status = 'active'
      and (end_time is null or end_time > now())
  ) then
    raise exception 'Competition is no longer active';
  end if;
  insert into public.study_participants (competition_id, user_id, total_study_time)
  values (p_competition_id, auth.uid(), 0)
  on conflict (competition_id, user_id) do nothing;
  return true;
end;
$$;

revoke all on function public.create_study_competition(text) from public, anon;
grant execute on function public.create_study_competition(text) to authenticated;
revoke all on function public.join_study_competition(uuid) from public, anon;
grant execute on function public.join_study_competition(uuid) to authenticated;
revoke all on function public.pause_study_session(uuid) from public, anon;
grant execute on function public.pause_study_session(uuid) to authenticated;
revoke all on function public.resume_study_session(uuid) from public, anon;
grant execute on function public.resume_study_session(uuid) to authenticated;
revoke all on function public.heartbeat_study_presence(uuid) from public, anon;
grant execute on function public.heartbeat_study_presence(uuid) to authenticated;

-- Clients can read session and competition data but cannot forge time, rewards, or participant totals.
revoke insert, update, delete on public.study_sessions from authenticated, anon;
grant select on public.study_sessions to authenticated;
revoke insert, update, delete on public.study_participants from authenticated, anon;
grant select on public.study_participants to authenticated;
revoke insert, update, delete on public.study_competitions from authenticated, anon;
grant select on public.study_competitions to authenticated;
revoke insert, update, delete on public.study_live_status from authenticated, anon;
grant select on public.study_live_status to authenticated;

-- Exact statistics are calculated from the full session history, in the student's local timezone.
create or replace function public.get_study_mode_stats(p_timezone text default 'UTC')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_timezone text := coalesce(nullif(trim(p_timezone), ''), 'UTC');
  v_today date;
  v_week_start date;
  v_today_minutes bigint := 0;
  v_week_minutes bigint := 0;
  v_streak integer := 0;
  v_pomodoros bigint := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    v_timezone := 'UTC';
  end if;
  v_today := (now() at time zone v_timezone)::date;
  v_week_start := v_today - (extract(isodow from v_today)::integer - 1);

  select coalesce(sum(duration), 0), count(*) filter (where mode = 'pomodoro')
    into v_today_minutes, v_pomodoros
  from public.study_sessions
  where user_id = v_uid and status = 'completed' and duration > 0
    and (coalesce(end_time, created_at) at time zone v_timezone)::date = v_today;

  select coalesce(sum(duration), 0)
    into v_week_minutes
  from public.study_sessions
  where user_id = v_uid and status = 'completed' and duration > 0
    and (coalesce(end_time, created_at) at time zone v_timezone)::date between v_week_start and v_today;

  with studied_days as (
    select distinct (coalesce(end_time, created_at) at time zone v_timezone)::date as study_date
    from public.study_sessions
    where user_id = v_uid and status = 'completed' and duration > 0
  )
  select count(*)::integer into v_streak
  from generate_series(0, 365) offsets(n)
  where exists (select 1 from studied_days d where d.study_date = v_today - offsets.n)
    and not exists (
      select 1 from generate_series(0, offsets.n - 1) prior(n)
      where not exists (select 1 from studied_days d where d.study_date = v_today - prior.n)
    );

  return jsonb_build_object(
    'today_minutes', v_today_minutes,
    'week_minutes', v_week_minutes,
    'streak_days', v_streak,
    'pomodoros_today', v_pomodoros
  );
end;
$$;

revoke all on function public.get_study_mode_stats(text) from public, anon;
grant execute on function public.get_study_mode_stats(text) to authenticated;

-- The personal rank is calculated over every participant, not just the visible top 50.
create or replace function public.get_my_study_period_summary(
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns table (
  user_id uuid,
  name text,
  total_minutes bigint,
  focus_sessions bigint,
  updated_at timestamptz,
  rank bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at or p_end_at > now() + interval '5 minutes' then
    raise exception 'A valid leaderboard date range is required';
  end if;

  return query
  with totals as (
    select ss.user_id,
      sum(greatest(coalesce(ss.duration, 0), 0))::bigint as total_minutes,
      count(*)::bigint as focus_sessions,
      max(coalesce(ss.end_time, ss.created_at)) as updated_at
    from public.study_sessions ss
    where ss.status = 'completed'
      and coalesce(ss.end_time, ss.created_at) >= p_start_at
      and coalesce(ss.end_time, ss.created_at) < p_end_at
      and coalesce(ss.duration, 0) > 0
    group by ss.user_id
  ), ranked as (
    select t.*, row_number() over (order by t.total_minutes desc, t.focus_sessions desc, t.updated_at asc) as rank
    from totals t
  )
  select r.user_id,
    coalesce(nullif(trim(p.name), ''), nullif(trim(p.username), ''), 'Student') as name,
    r.total_minutes, r.focus_sessions, r.updated_at, r.rank
  from ranked r
  left join public.profiles p on p.id = r.user_id
  where r.user_id = auth.uid();
end;
$$;

revoke all on function public.get_my_study_period_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_my_study_period_summary(timestamptz, timestamptz) to authenticated;

-- Ensure all Study Mode data sources actually emit Postgres Changes events.
do $$
begin
  begin alter publication supabase_realtime add table public.study_sessions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.study_tasks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.study_competitions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.study_participants; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.study_live_status; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.study_settings; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.study_call_participants; exception when duplicate_object then null; end;
end $$;
