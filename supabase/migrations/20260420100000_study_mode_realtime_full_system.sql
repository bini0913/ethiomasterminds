-- Full realtime study mode system

alter table public.profiles
  add column if not exists total_study_time integer not null default 0;

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

create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_title text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.study_sessions
  add column if not exists start_time timestamptz,
  add column if not exists end_time timestamptz,
  add column if not exists status text,
  add column if not exists competition_id uuid references public.study_competitions(id) on delete set null;

-- Backfill old records to completed session semantics.
update public.study_sessions
set
  start_time = coalesce(start_time, created_at - make_interval(secs => greatest(duration, 0))),
  end_time = coalesce(end_time, created_at),
  status = coalesce(status, 'completed')
where start_time is null or end_time is null or status is null;

alter table public.study_sessions
  alter column start_time set default now(),
  alter column start_time set not null,
  alter column status set default 'active',
  alter column status set not null;

alter table public.study_sessions
  drop constraint if exists study_sessions_status_check;

alter table public.study_sessions
  add constraint study_sessions_status_check check (status in ('active', 'completed'));

-- Existing duration may store seconds from legacy implementation; normalize to minutes for completed rows.
update public.study_sessions
set duration = greatest(1, ceil(greatest(extract(epoch from (coalesce(end_time, now()) - start_time)), 0) / 60.0)::integer)
where status = 'completed';

create index if not exists idx_study_tasks_user_created_at on public.study_tasks(user_id, created_at desc);
create index if not exists idx_study_sessions_user_status on public.study_sessions(user_id, status, created_at desc);
create index if not exists idx_study_competitions_status_time on public.study_competitions(status, start_time, end_time);
create index if not exists idx_study_participants_competition on public.study_participants(competition_id, total_study_time desc);

alter table public.study_competitions enable row level security;
alter table public.study_participants enable row level security;
alter table public.study_live_status enable row level security;
alter table public.study_tasks enable row level security;

create policy if not exists "users_view_active_competitions"
on public.study_competitions
for select
using (true);

create policy if not exists "users_create_competitions"
on public.study_competitions
for insert
with check (auth.uid() = created_by);

create policy if not exists "creators_update_competitions"
on public.study_competitions
for update
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

create policy if not exists "participants_view_participants"
on public.study_participants
for select
using (true);

create policy if not exists "users_join_competitions"
on public.study_participants
for insert
with check (auth.uid() = user_id);

create policy if not exists "users_view_live_status"
on public.study_live_status
for select
using (true);

create policy if not exists "users_upsert_own_live_status"
on public.study_live_status
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "users_manage_own_study_tasks"
on public.study_tasks
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.stop_study_session(p_session_id uuid)
returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_session public.study_sessions%rowtype;
  v_minutes integer;
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
    return v_session;
  end if;

  v_minutes := greatest(1, ceil(greatest(extract(epoch from (v_now - v_session.start_time)), 0) / 60.0)::integer);

  update public.study_sessions
  set
    end_time = v_now,
    duration = v_minutes,
    status = 'completed'
  where id = v_session.id
  returning * into v_session;

  update public.profiles
  set total_study_time = coalesce(total_study_time, 0) + v_minutes
  where id = v_uid;

  update public.study_participants sp
  set total_study_time = coalesce(sp.total_study_time, 0) + v_minutes
  from public.study_competitions sc
  where sp.competition_id = sc.id
    and sp.user_id = v_uid
    and sc.status = 'active'
    and sc.start_time <= v_now
    and (sc.end_time is null or sc.end_time >= v_now);

  insert into public.study_live_status as sls (user_id, is_studying, current_session_start, updated_at)
  values (v_uid, false, null, v_now)
  on conflict (user_id)
  do update set
    is_studying = excluded.is_studying,
    current_session_start = excluded.current_session_start,
    updated_at = excluded.updated_at;

  return v_session;
end;
$$;

grant execute on function public.stop_study_session(uuid) to authenticated;

-- Realtime publications
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
END $$;
