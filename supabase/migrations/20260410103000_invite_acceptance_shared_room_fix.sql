-- Ensure invite acceptance always places both inviter and receiver in the same room.
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

    -- Critical guarantee: host is always in the room.
    insert into public.room_players (room_id, user_id, is_ready)
    values (v_invite.room_id, v_invite.sender_id, false)
    on conflict (room_id, user_id) do nothing;

    -- Receiver joins same room.
    insert into public.room_players (room_id, user_id, is_ready)
    values (v_invite.room_id, v_user_id, false)
    on conflict (room_id, user_id) do nothing;

    update public.multiplayer_rooms
    set status = case when status = 'finished' then 'waiting' else status end
    where id = v_invite.room_id;
  end if;

  return v_invite;
end;
$$;
