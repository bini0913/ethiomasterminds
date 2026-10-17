-- Private, friend-only study call rooms. Tokens are issued only after participant membership is verified.
create table if not exists public.study_call_rooms (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create table if not exists public.study_call_participants (
  room_id uuid not null references public.study_call_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited','accepted','declined','left')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (room_id, user_id)
);
alter table public.study_call_rooms enable row level security;
alter table public.study_call_participants enable row level security;
drop policy if exists "study call participants can view their rooms" on public.study_call_rooms;
create policy "study call participants can view their rooms" on public.study_call_rooms for select to authenticated
using (exists (select 1 from public.study_call_participants p where p.room_id = id and p.user_id = auth.uid()));
drop policy if exists "users create own study call rooms" on public.study_call_rooms;
create policy "users create own study call rooms" on public.study_call_rooms for insert to authenticated with check (auth.uid() = created_by);
drop policy if exists "participants can view own invitations" on public.study_call_participants;
create policy "participants can view own invitations" on public.study_call_participants for select to authenticated
using (auth.uid() = user_id or auth.uid() = invited_by);
drop policy if exists "users invite friends to own call" on public.study_call_participants;
create policy "users invite friends to own call" on public.study_call_participants for insert to authenticated
with check (invited_by = auth.uid() and exists (select 1 from public.study_call_rooms r where r.id = room_id and r.created_by = auth.uid())
 and (user_id = auth.uid() or exists (select 1 from public.friends f where f.status = 'accepted'
 and ((f.user_id = auth.uid() and f.friend_id = study_call_participants.user_id) or (f.friend_id = auth.uid() and f.user_id = study_call_participants.user_id)))));
drop policy if exists "invitee responds to own call invitation" on public.study_call_participants;
create policy "invitee responds to own call invitation" on public.study_call_participants for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid() and status in ('accepted','declined','left'));
create index if not exists idx_study_call_participants_user_status on public.study_call_participants(user_id, status, created_at desc);
do $$ begin alter publication supabase_realtime add table public.study_call_participants; exception when duplicate_object then null; end $$;
