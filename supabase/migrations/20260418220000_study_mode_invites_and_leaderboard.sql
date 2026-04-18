-- Study mode collaboration: friend invites + global time leaderboard
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

create index if not exists idx_study_room_invites_receiver_pending
  on public.study_room_invites(receiver_id, status, created_at desc);

create index if not exists idx_study_room_invites_sender_created
  on public.study_room_invites(sender_id, created_at desc);

create unique index if not exists uniq_study_room_pending_invite
  on public.study_room_invites(room_id, sender_id, receiver_id)
  where status = 'pending';

alter table public.study_room_invites enable row level security;

create policy if not exists "invite_participants_view_study_room_invites"
on public.study_room_invites
for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy if not exists "senders_create_study_room_invites"
on public.study_room_invites
for insert
with check (auth.uid() = sender_id);

create policy if not exists "receivers_or_senders_update_study_room_invites"
on public.study_room_invites
for update
using (auth.uid() = sender_id or auth.uid() = receiver_id)
with check (auth.uid() = sender_id or auth.uid() = receiver_id);

create or replace function public.create_study_room_invite(
  p_room_id uuid,
  p_receiver_id uuid,
  p_message text default null
)
returns public.study_room_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_invite public.study_room_invites%rowtype;
  v_is_friend boolean := false;
begin
  if v_sender is null then
    raise exception 'Authentication required';
  end if;

  if p_receiver_id = v_sender then
    raise exception 'You cannot invite yourself';
  end if;

  if not exists (
    select 1 from public.study_rooms r
    where r.id = p_room_id and (
      r.host_id = v_sender
      or exists (
        select 1 from public.room_members rm
        where rm.room_id = r.id and rm.user_id = v_sender
      )
    )
  ) then
    raise exception 'You can only invite from a room you belong to';
  end if;

  select exists (
    select 1
    from public.friends f
    where f.status = 'accepted'
      and (
        (f.user_id = v_sender and f.friend_id = p_receiver_id)
        or (f.friend_id = v_sender and f.user_id = p_receiver_id)
      )
  ) into v_is_friend;

  if not v_is_friend then
    raise exception 'Only accepted friends can be invited';
  end if;

  if exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id and rm.user_id = p_receiver_id
  ) then
    raise exception 'This friend is already in the room';
  end if;

  update public.study_room_invites
  set status = 'expired', responded_at = now()
  where status = 'pending' and expires_at <= now();

  insert into public.study_room_invites (room_id, sender_id, receiver_id, message)
  values (p_room_id, v_sender, p_receiver_id, nullif(trim(coalesce(p_message, '')), ''))
  returning * into v_invite;

  return v_invite;
end;
$$;

create or replace function public.respond_study_room_invite(
  p_invite_id uuid,
  p_response text
)
returns public.study_room_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invite public.study_room_invites%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if p_response not in ('accepted', 'declined') then
    raise exception 'Invalid response: %', p_response;
  end if;

  select * into v_invite
  from public.study_room_invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.receiver_id <> v_user then
    raise exception 'Only the receiver can respond to this invite';
  end if;

  if v_invite.status <> 'pending' then
    return v_invite;
  end if;

  if v_invite.expires_at <= now() then
    update public.study_room_invites
    set status = 'expired', responded_at = now()
    where id = v_invite.id
    returning * into v_invite;

    return v_invite;
  end if;

  update public.study_room_invites
  set status = p_response, responded_at = now()
  where id = v_invite.id
  returning * into v_invite;

  if p_response = 'accepted' then
    insert into public.room_members (room_id, user_id)
    values (v_invite.room_id, v_user)
    on conflict (room_id, user_id) do nothing;
  end if;

  return v_invite;
end;
$$;

grant execute on function public.create_study_room_invite(uuid, uuid, text) to authenticated;
grant execute on function public.respond_study_room_invite(uuid, text) to authenticated;

create or replace function public.get_study_time_leaderboard(p_limit integer default 25)
returns table (
  user_id uuid,
  name text,
  total_minutes bigint,
  focus_sessions bigint,
  completed_tasks bigint,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with sessions as (
    select
      ss.user_id,
      coalesce(sum(case when ss.type = 'break' then 0 else greatest(ss.duration, 0) end) / 60, 0)::bigint as total_minutes,
      count(*) filter (where ss.type <> 'break')::bigint as focus_sessions,
      max(ss.created_at) as updated_at
    from public.study_sessions ss
    group by ss.user_id
  ),
  completed as (
    select t.user_id, count(*)::bigint as completed_tasks
    from public.tasks t
    where t.completed = true
    group by t.user_id
  )
  select
    s.user_id,
    coalesce(nullif(trim(p.name), ''), nullif(trim(p.username), ''), concat('User ', left(s.user_id::text, 8))) as name,
    s.total_minutes,
    s.focus_sessions,
    coalesce(c.completed_tasks, 0)::bigint as completed_tasks,
    s.updated_at
  from sessions s
  left join public.profiles p on p.id = s.user_id
  left join completed c on c.user_id = s.user_id
  order by s.total_minutes desc, coalesce(c.completed_tasks, 0) desc, s.focus_sessions desc
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

grant execute on function public.get_study_time_leaderboard(integer) to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.study_room_invites;
  exception
    when duplicate_object then
      null;
  end;
end $$;
