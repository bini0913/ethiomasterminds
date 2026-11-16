-- Study Mode core tables
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  duration integer not null check (duration > 0),
  type text not null check (type in ('focus', 'break', 'custom')),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  completed boolean not null default false,
  linked_session_id uuid references public.study_sessions(id) on delete set null,
  created_at timestamptz not null default now()
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

alter table public.study_sessions enable row level security;
alter table public.tasks enable row level security;
alter table public.study_rooms enable row level security;
alter table public.room_members enable row level security;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'study_sessions' AND policyname = 'users_manage_own_study_sessions'
  ) THEN
    CREATE POLICY "users_manage_own_study_sessions" ON public.study_sessions
    for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'users_manage_own_tasks'
  ) THEN
    CREATE POLICY "users_manage_own_tasks" ON public.tasks
    for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'study_rooms' AND policyname = 'hosts_manage_rooms'
  ) THEN
    CREATE POLICY "hosts_manage_rooms" ON public.study_rooms
    for all
using (auth.uid() = host_id)
with check (auth.uid() = host_id);
  END IF;
END
$policy$;


DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'study_rooms' AND policyname = 'members_or_open_rooms_can_view_rooms'
  ) THEN
    CREATE POLICY "members_or_open_rooms_can_view_rooms" ON public.study_rooms
    for select
using (
  status in ('open', 'live')
  or auth.uid() = host_id
  or exists (
    select 1
    from public.room_members rm
    where rm.room_id = study_rooms.id
      and rm.user_id = auth.uid()
  )
);
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'room_members' AND policyname = 'members_view_room_members'
  ) THEN
    CREATE POLICY "members_view_room_members" ON public.room_members
    for select
using (
  exists (
    select 1
    from public.room_members rm
    where rm.room_id = room_members.room_id
      and rm.user_id = auth.uid()
  )
);
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'room_members' AND policyname = 'users_manage_membership_rows'
  ) THEN
    CREATE POLICY "users_manage_membership_rows" ON public.room_members
    for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
  END IF;
END
$policy$;

-- Useful indexes
create index if not exists idx_study_sessions_user_created_at on public.study_sessions(user_id, created_at desc);
create index if not exists idx_tasks_user_created_at on public.tasks(user_id, created_at desc);
create index if not exists idx_room_members_user on public.room_members(user_id);
