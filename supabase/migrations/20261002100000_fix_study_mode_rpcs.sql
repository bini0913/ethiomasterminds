-- Repair Study Mode RPCs used by the current StudyModePage client.
-- The existing database only exposed complete_study_session(uuid), while the app
-- calls the richer start/complete contracts below.

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
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_planned_duration < 1 or p_planned_duration > 180 then
    raise exception 'Planned duration must be between 1 and 180 minutes';
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
  ) then
    raise exception 'Selected competition is not active';
  end if;

  if p_competition_id is not null and not exists (
    select 1 from public.study_participants
    where competition_id = p_competition_id and user_id = auth.uid()
  ) then
    raise exception 'Join the selected competition before starting a session';
  end if;

  insert into public.study_sessions(
    user_id, competition_id, mode, planned_duration, status, start_time
  )
  values (
    auth.uid(), p_competition_id, coalesce(nullif(trim(p_mode), ''), 'pomodoro'),
    p_planned_duration, 'active', now()
  )
  returning * into v_session;

  return v_session;
end;
$$;

revoke all on function public.start_study_session(uuid,text,integer) from public;
grant execute on function public.start_study_session(uuid,text,integer) to authenticated;

drop function if exists public.complete_study_session(uuid,numeric,uuid,boolean);

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
  v_session public.study_sessions;
  v_duration integer;
  v_xp integer;
  v_coins integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_session
  from public.study_sessions
  where id = p_session_id and user_id = auth.uid()
  for update;

  if not found then raise exception 'Study session not found'; end if;
  if v_session.status <> 'active' then raise exception 'Study session is not active'; end if;

  v_duration := greatest(
    1,
    coalesce(
      p_duration_override,
      extract(epoch from (now() - v_session.start_time))::integer / 60
    )
  );

  update public.study_sessions
  set status = 'completed',
      end_time = now(),
      duration = v_duration
  where id = p_session_id;

  if p_task_id is not null and p_mark_task_complete then
    update public.study_tasks
    set completed = true
    where id = p_task_id and user_id = auth.uid();
  end if;

  if v_session.competition_id is not null then
    update public.study_participants
    set total_study_time = total_study_time + v_duration
    where competition_id = v_session.competition_id and user_id = auth.uid();
  end if;

  update public.study_live_status
  set is_studying = false,
      current_session_start = null,
      updated_at = now()
  where user_id = auth.uid();

  v_xp := v_duration * 10;
  v_coins := v_duration;

  update public.profiles
  set xp = coalesce(xp, 0) + v_xp,
      season_xp = coalesce(season_xp, 0) + v_xp,
      updated_at = now()
  where id = auth.uid();

  update public.user_currency
  set coins = coalesce(coins, 0) + v_coins,
      updated_at = now()
  where user_id = auth.uid();

  return jsonb_build_object(
    'session_id', v_session.id,
    'duration', v_duration,
    'xp_earned', v_xp,
    'coins_earned', v_coins
  );
end;
$$;

revoke all on function public.complete_study_session(uuid,integer,uuid,boolean) from public;
grant execute on function public.complete_study_session(uuid,integer,uuid,boolean) to authenticated;
