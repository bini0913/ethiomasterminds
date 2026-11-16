-- PUBG/CODM-style invite lobby primitives

create table if not exists public.multiplayer_invites (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.multiplayer_rooms(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '25 seconds'),
  responded_at timestamptz
);

create index if not exists idx_multiplayer_invites_receiver_pending
  on public.multiplayer_invites(receiver_id, status, expires_at desc);

create index if not exists idx_multiplayer_invites_sender_created
  on public.multiplayer_invites(sender_id, created_at desc);

alter table public.multiplayer_invites enable row level security;

drop policy if exists "Invite participants can view invites" on public.multiplayer_invites;
create policy "Invite participants can view invites"
  on public.multiplayer_invites for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Authenticated users can create invites" on public.multiplayer_invites;
create policy "Authenticated users can create invites"
  on public.multiplayer_invites for insert
  with check (auth.uid() = sender_id);

drop policy if exists "Invite participants can update invites" on public.multiplayer_invites;
create policy "Invite participants can update invites"
  on public.multiplayer_invites for update
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create or replace function public.create_multiplayer_invite(
  p_receiver_id uuid,
  p_room_id uuid default null,
  p_max_players integer default 2,
  p_subject text default 'Mixed',
  p_difficulty text default 'Medium'
)
returns public.multiplayer_invites
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sender uuid := auth.uid();
  v_room public.multiplayer_rooms%rowtype;
  v_invite public.multiplayer_invites%rowtype;
  v_online_sender boolean;
  v_online_receiver boolean;
  v_receiver_busy boolean;
begin
  if v_sender is null then
    raise exception 'Not authenticated';
  end if;

  if p_receiver_id = v_sender then
    raise exception 'You cannot invite yourself';
  end if;

  -- expire stale pending invites lazily
  update public.multiplayer_invites
  set status = 'expired', responded_at = now()
  where status = 'pending' and expires_at <= now();

  select exists (
    select 1 from public.user_presence
    where user_id = v_sender and status = 'online' and last_seen >= now() - interval '5 minutes'
  ) into v_online_sender;

  if not v_online_sender then
    raise exception 'You must be online to send invites';
  end if;

  select exists (
    select 1 from public.user_presence
    where user_id = p_receiver_id and status = 'online' and last_seen >= now() - interval '5 minutes'
  ) into v_online_receiver;

  if not v_online_receiver then
    raise exception 'Player is offline';
  end if;

  if exists (
    select 1 from public.multiplayer_invites
    where sender_id = v_sender
      and created_at >= now() - interval '8 seconds'
      and status = 'pending'
  ) then
    raise exception 'Invite cooldown active. Try again in a moment.';
  end if;

  if exists (
    select 1 from public.multiplayer_invites
    where sender_id = v_sender
      and receiver_id = p_receiver_id
      and status = 'pending'
      and expires_at > now()
  ) then
    raise exception 'Invite already pending';
  end if;

  select exists (
    select 1
    from public.room_players rp
    join public.multiplayer_rooms mr on mr.id = rp.room_id
    where rp.user_id = p_receiver_id
      and mr.status in ('waiting', 'countdown', 'playing')
  ) into v_receiver_busy;

  if v_receiver_busy then
    raise exception 'Player is already in an active match';
  end if;

  if p_room_id is not null then
    select * into v_room from public.multiplayer_rooms where id = p_room_id;
    if not found then
      raise exception 'Room not found';
    end if;
    if v_room.host_id <> v_sender then
      raise exception 'Only host can invite from this room';
    end if;
  else
    insert into public.multiplayer_rooms (
      name, host_id, max_players, subject, difficulty, question_count, status
    )
    values (
      'Squad Lobby',
      v_sender,
      greatest(2, coalesce(p_max_players, 2)),
      coalesce(p_subject, 'Mixed'),
      coalesce(p_difficulty, 'Medium'),
      10,
      'waiting'
    )
    returning * into v_room;

    insert into public.room_players (room_id, user_id, is_ready)
    values (v_room.id, v_sender, true)
    on conflict (room_id, user_id) do update set is_ready = excluded.is_ready;
  end if;

  insert into public.multiplayer_invites (sender_id, receiver_id, room_id, status, expires_at)
  values (v_sender, p_receiver_id, v_room.id, 'pending', now() + interval '25 seconds')
  returning * into v_invite;

  return v_invite;
end;
$$;

create or replace function public.respond_multiplayer_invite(
  p_invite_id uuid,
  p_response text
)
returns public.multiplayer_invites
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.multiplayer_invites%rowtype;
  v_room public.multiplayer_rooms%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite from public.multiplayer_invites where id = p_invite_id for update;
  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.receiver_id <> v_user_id then
    raise exception 'Only receiver can respond';
  end if;

  if v_invite.status <> 'pending' then
    return v_invite;
  end if;

  if v_invite.expires_at <= now() then
    update public.multiplayer_invites
    set status = 'expired', responded_at = now()
    where id = p_invite_id
    returning * into v_invite;
    return v_invite;
  end if;

  if p_response not in ('accepted', 'rejected') then
    raise exception 'Invalid response';
  end if;

  update public.multiplayer_invites
  set status = p_response, responded_at = now()
  where id = p_invite_id
  returning * into v_invite;

  if p_response = 'accepted' then
    select * into v_room from public.multiplayer_rooms where id = v_invite.room_id;
    if not found or v_room.status not in ('waiting', 'countdown', 'playing') then
      raise exception 'Room unavailable';
    end if;

    insert into public.room_players (room_id, user_id, is_ready)
    values (v_invite.room_id, v_user_id, false)
    on conflict (room_id, user_id) do nothing;
  end if;

  return v_invite;
end;
$$;

grant execute on function public.create_multiplayer_invite(uuid, uuid, integer, text, text) to authenticated;
grant execute on function public.respond_multiplayer_invite(uuid, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.multiplayer_invites;
exception
  when duplicate_object then null;
end $$;
