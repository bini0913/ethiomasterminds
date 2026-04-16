-- Study room invites for friend collaboration
create table if not exists public.study_room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create index if not exists idx_study_room_invites_receiver_pending
  on public.study_room_invites(receiver_id, status, created_at desc);

create index if not exists idx_study_room_invites_room
  on public.study_room_invites(room_id, created_at desc);

create unique index if not exists uq_study_room_invites_pending
  on public.study_room_invites(room_id, sender_id, receiver_id)
  where status = 'pending';

alter table public.study_room_invites enable row level security;

create policy if not exists "study_invite_participants_can_view"
on public.study_room_invites
for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy if not exists "study_invite_sender_can_create"
on public.study_room_invites
for insert
with check (auth.uid() = sender_id);

create policy if not exists "study_invite_participants_can_update"
on public.study_room_invites
for update
using (auth.uid() = sender_id or auth.uid() = receiver_id)
with check (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Global top-10 leaderboard by studied minutes (all-time)
create or replace function public.get_study_top_students(p_limit int default 10)
returns table (
  user_id uuid,
  name text,
  total_minutes bigint
)
language sql
security definer
set search_path = public
as $$
  select
    ss.user_id,
    coalesce(p.name, 'Student') as name,
    sum(ss.duration)::bigint / 60 as total_minutes
  from public.study_sessions ss
  left join public.profiles p on p.id = ss.user_id
  group by ss.user_id, p.name
  order by sum(ss.duration) desc
  limit greatest(1, least(coalesce(p_limit, 10), 100));
$$;

grant execute on function public.get_study_top_students(int) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'study_room_invites'
  ) then
    alter publication supabase_realtime add table public.study_room_invites;
  end if;
end $$;
