-- Elite Study Mode upgrade: planned durations, modes, settings and rewards pipeline

alter table public.study_sessions
  add column if not exists planned_duration integer,
  add column if not exists mode text,
  add column if not exists paused_at timestamptz;

update public.study_sessions
set planned_duration = coalesce(planned_duration, greatest(duration, 25))
where planned_duration is null;

update public.study_sessions
set mode = coalesce(mode, 'pomodoro')
where mode is null;

alter table public.study_sessions
  alter column planned_duration set default 25,
  alter column planned_duration set not null,
  alter column mode set default 'pomodoro',
  alter column mode set not null;

alter table public.study_sessions
  drop constraint if exists study_sessions_mode_check;

alter table public.study_sessions
  add constraint study_sessions_mode_check check (mode in ('pomodoro', 'deep', 'custom'));

create table if not exists public.study_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_study_time integer not null default 25 check (default_study_time between 5 and 180),
  default_break_time integer not null default 5 check (default_break_time between 1 and 30),
  auto_start_break boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_settings enable row level security;

create policy if not exists "users_manage_own_study_settings"
on public.study_settings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.touch_study_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_study_settings_updated_at on public.study_settings;

create trigger trg_touch_study_settings_updated_at
before update on public.study_settings
for each row execute function public.touch_study_settings_updated_at();

create or replace function public.complete_study_session(
  p_session_id uuid,
  p_duration_override integer default null,
  p_task_id uuid default null,
  p_mark_task_complete boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_session public.study_sessions%rowtype;
  v_minutes integer;
  v_xp_rate integer := 10;
  v_coin_rate numeric := 1.0;
  v_xp integer;
  v_coins integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_session
  from public.study_sessions
  where id = p_session_id
    and user_id = v_uid
  for update;

  if not found then
    raise exception 'Session not found';
  end if;

  if v_session.status = 'completed' then
    return jsonb_build_object(
      'session_id', v_session.id,
      'duration', v_session.duration,
      'xp_earned', 0,
      'coins_earned', 0,
      'already_completed', true
    );
  end if;

  v_minutes := greatest(
    1,
    coalesce(
      p_duration_override,
      ceil(greatest(extract(epoch from (v_now - v_session.start_time)), 0) / 60.0)::integer
    )
  );

  v_xp := greatest(0, v_minutes * v_xp_rate);
  v_coins := greatest(0, floor(v_minutes * v_coin_rate)::integer);

  update public.study_sessions
  set
    end_time = v_now,
    duration = v_minutes,
    status = 'completed'
  where id = v_session.id
  returning * into v_session;

  update public.profiles
  set
    total_study_time = coalesce(total_study_time, 0) + v_minutes,
    total_xp = coalesce(total_xp, 0) + v_xp,
    season_xp = coalesce(season_xp, 0) + v_xp,
    xp = coalesce(total_xp, 0) + v_xp,
    coins = coalesce(coins, 0) + v_coins,
    level = floor((coalesce(total_xp, 0) + v_xp) / 100) + 1
  where id = v_uid;

  update public.study_participants sp
  set total_study_time = coalesce(sp.total_study_time, 0) + v_minutes
  from public.study_competitions sc
  where sp.competition_id = sc.id
    and sp.user_id = v_uid
    and sc.status = 'active'
    and sc.start_time <= v_now
    and (sc.end_time is null or sc.end_time >= v_now)
    and (v_session.competition_id is null or sp.competition_id = v_session.competition_id);

  if p_mark_task_complete and p_task_id is not null then
    update public.study_tasks
    set completed = true
    where id = p_task_id
      and user_id = v_uid;
  end if;

  insert into public.study_live_status as sls (user_id, is_studying, current_session_start, updated_at)
  values (v_uid, false, null, v_now)
  on conflict (user_id)
  do update set
    is_studying = excluded.is_studying,
    current_session_start = excluded.current_session_start,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'session_id', v_session.id,
    'duration', v_minutes,
    'xp_earned', v_xp,
    'coins_earned', v_coins,
    'already_completed', false
  );
end;
$$;

grant execute on function public.complete_study_session(uuid, integer, uuid, boolean) to authenticated;

DO $$
BEGIN
  BEGIN
    alter publication supabase_realtime add table public.study_settings;
  EXCEPTION WHEN duplicate_object THEN null; END;
END $$;
