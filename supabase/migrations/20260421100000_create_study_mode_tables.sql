-- Create/repair all Study Mode tables in their latest schema.

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  duration integer not null check (duration > 0),
  type text not null check (type in ('focus', 'break', 'custom')),
  created_at timestamptz not null default now(),
  start_time timestamptz not null default now(),
  end_time timestamptz,
  status text not null default 'active' check (status in ('active', 'completed')),
  competition_id uuid,
  planned_duration integer not null default 25 check (planned_duration between 1 and 600),
  mode text not null default 'pomodoro' check (mode in ('pomodoro', 'deep', 'custom')),
  paused_at timestamptz
);

alter table public.study_sessions
  add column if not exists start_time timestamptz,
  add column if not exists end_time timestamptz,
  add column if not exists status text,
  add column if not exists competition_id uuid,
  add column if not exists planned_duration integer,
  add column if not exists mode text,
  add column if not exists paused_at timestamptz;

update public.study_sessions
set
  start_time = coalesce(start_time, created_at - make_interval(secs => greatest(duration, 0))),
  end_time = coalesce(end_time, created_at),
  status = coalesce(status, 'completed'),
  planned_duration = coalesce(planned_duration, greatest(duration, 25)),
  mode = coalesce(mode, 'pomodoro')
where
  start_time is null
  or end_time is null
  or status is null
  or planned_duration is null
  or mode is null;

alter table public.study_sessions
  alter column start_time set default now(),
  alter column start_time set not null,
  alter column status set default 'active',
  alter column status set not null,
  alter column planned_duration set default 25,
  alter column planned_duration set not null,
  alter column mode set default 'pomodoro',
  alter column mode set not null;

alter table public.study_sessions
  drop constraint if exists study_sessions_status_check;

alter table public.study_sessions
  add constraint study_sessions_status_check
  check (status in ('active', 'completed'));

alter table public.study_sessions
  drop constraint if exists study_sessions_mode_check;

alter table public.study_sessions
  add constraint study_sessions_mode_check
  check (mode in ('pomodoro', 'deep', 'custom'));

create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_title text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.study_competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  start_time timestamptz not null default now(),
  end_time timestamptz,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now()
);

create table if not exists public.study_participants (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.study_competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  total_study_time integer not null default 0,
  created_at timestamptz not null default now(),
  unique (competition_id, user_id)
);

create table if not exists public.study_live_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_studying boolean not null default false,
  current_session_start timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.study_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_study_time integer not null default 25 check (default_study_time between 5 and 180),
  default_break_time integer not null default 5 check (default_break_time between 1 and 30),
  auto_start_break boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'live', 'completed', 'archived')),
  title text not null default 'Study Room',
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  study_time integer not null default 0,
  tasks_completed integer not null default 0,
  focus_streak integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.study_room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  message text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '3 days')
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'study_sessions_competition_fk'
      and conrelid = 'public.study_sessions'::regclass
  ) then
    alter table public.study_sessions
      add constraint study_sessions_competition_fk
      foreign key (competition_id) references public.study_competitions(id) on delete set null;
  end if;
end $$;

alter table public.study_sessions enable row level security;
alter table public.study_tasks enable row level security;
alter table public.study_competitions enable row level security;
alter table public.study_participants enable row level security;
alter table public.study_live_status enable row level security;
alter table public.study_settings enable row level security;
alter table public.study_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.study_room_invites enable row level security;

create policy if not exists "users_manage_own_study_sessions"
on public.study_sessions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "users_manage_own_study_tasks"
on public.study_tasks for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "users_view_active_competitions"
on public.study_competitions for select
using (true);

create policy if not exists "users_create_competitions"
on public.study_competitions for insert
with check (auth.uid() = created_by);

create policy if not exists "creators_update_competitions"
on public.study_competitions for update
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

create policy if not exists "participants_view_participants"
on public.study_participants for select
using (true);

create policy if not exists "users_join_competitions"
on public.study_participants for insert
with check (auth.uid() = user_id);

create policy if not exists "users_view_live_status"
on public.study_live_status for select
using (true);

create policy if not exists "users_upsert_own_live_status"
on public.study_live_status for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "users_manage_own_study_settings"
on public.study_settings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "hosts_manage_rooms"
on public.study_rooms for all
using (auth.uid() = host_id)
with check (auth.uid() = host_id);

create policy if not exists "members_or_open_rooms_can_view_rooms"
on public.study_rooms for select
using (
  status in ('open', 'live')
  or auth.uid() = host_id
  or exists (
    select 1 from public.room_members rm
    where rm.room_id = study_rooms.id and rm.user_id = auth.uid()
  )
);

create policy if not exists "members_view_room_members"
on public.room_members for select
using (
  exists (
    select 1 from public.room_members rm
    where rm.room_id = room_members.room_id
      and rm.user_id = auth.uid()
  )
);

create policy if not exists "users_manage_membership_rows"
on public.room_members for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "invite_participants_view_study_room_invites"
on public.study_room_invites for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy if not exists "senders_create_study_room_invites"
on public.study_room_invites for insert
with check (auth.uid() = sender_id);

create policy if not exists "receivers_or_senders_update_study_room_invites"
on public.study_room_invites for update
using (auth.uid() = sender_id or auth.uid() = receiver_id)
with check (auth.uid() = sender_id or auth.uid() = receiver_id);

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
  v_xp := greatest(0, v_minutes * 10);
  v_coins := greatest(0, v_minutes);

  update public.study_sessions
  set
    end_time = v_now,
    duration = v_minutes,
    status = 'completed'
  where id = v_session.id
  returning * into v_session;

  if p_mark_task_complete and p_task_id is not null then
    update public.study_tasks
    set completed = true
    where id = p_task_id
      and user_id = v_uid;
  end if;

  update public.study_participants sp
  set total_study_time = coalesce(sp.total_study_time, 0) + v_minutes
  from public.study_competitions sc
  where sp.competition_id = sc.id
    and sp.user_id = v_uid
    and sc.status = 'active'
    and sc.start_time <= v_now
    and (sc.end_time is null or sc.end_time >= v_now)
    and (v_session.competition_id is null or sp.competition_id = v_session.competition_id);

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

create index if not exists idx_study_sessions_user_created_at on public.study_sessions(user_id, created_at desc);
create index if not exists idx_study_sessions_user_status on public.study_sessions(user_id, status, created_at desc);
create index if not exists idx_study_tasks_user_created_at on public.study_tasks(user_id, created_at desc);
create index if not exists idx_study_competitions_status_time on public.study_competitions(status, start_time, end_time);
create index if not exists idx_study_participants_competition on public.study_participants(competition_id, total_study_time desc);
create index if not exists idx_study_room_invites_receiver_pending on public.study_room_invites(receiver_id, status, created_at desc);
create index if not exists idx_study_room_invites_sender_created on public.study_room_invites(sender_id, created_at desc);
create unique index if not exists uniq_study_room_pending_invite
  on public.study_room_invites(room_id, sender_id, receiver_id)
  where status = 'pending';
create index if not exists idx_room_members_user on public.room_members(user_id);

DO $$
BEGIN
  BEGIN
    alter publication supabase_realtime add table public.study_sessions;
  EXCEPTION WHEN duplicate_object THEN null; END;

  BEGIN
    alter publication supabase_realtime add table public.study_tasks;
  EXCEPTION WHEN duplicate_object THEN null; END;

  BEGIN
    alter publication supabase_realtime add table public.study_competitions;
  EXCEPTION WHEN duplicate_object THEN null; END;

  BEGIN
    alter publication supabase_realtime add table public.study_participants;
  EXCEPTION WHEN duplicate_object THEN null; END;

  BEGIN
    alter publication supabase_realtime add table public.study_live_status;
  EXCEPTION WHEN duplicate_object THEN null; END;

  BEGIN
    alter publication supabase_realtime add table public.study_settings;
  EXCEPTION WHEN duplicate_object THEN null; END;

  BEGIN
    alter publication supabase_realtime add table public.study_room_invites;
  EXCEPTION WHEN duplicate_object THEN null; END;
END $$;
