-- Do not award a five-minute reward for a one-minute session.
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
  -- Rewards are bounded by the server-measured active time. A one-minute
  -- session earns one minute, not the old five-minute minimum.
  v_minutes := least(
    greatest(1, ceil(v_active_seconds / 60.0)::integer),
    greatest(1, coalesce(v_session.planned_duration, 25))
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
