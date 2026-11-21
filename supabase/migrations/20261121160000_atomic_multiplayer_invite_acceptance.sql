-- Make invite acceptance atomic with room membership insertion so concurrent
-- acceptances cannot both pass the capacity check and leave one invite in a
-- broken accepted-but-not-joined state.
create or replace function public.respond_multiplayer_invite(_invite_id uuid, _accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_room_id uuid;
  v_status text;
  v_expires_at timestamptz;
  v_max_players integer;
  v_player_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select room_id, status, expires_at
    into v_room_id, v_status, v_expires_at
  from public.multiplayer_invites
  where id = _invite_id
    and receiver_id = v_uid
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'Invite is no longer pending';
  end if;

  if v_expires_at <= clock_timestamp() then
    update public.multiplayer_invites
    set status = 'expired', responded_at = clock_timestamp()
    where id = _invite_id;
    raise exception 'Invite has expired';
  end if;

  if not _accept then
    update public.multiplayer_invites
    set status = 'rejected', responded_at = clock_timestamp()
    where id = _invite_id;
    return jsonb_build_object('status', 'rejected', 'room_id', v_room_id);
  end if;

  select max_players
    into v_max_players
  from public.multiplayer_rooms
  where id = v_room_id
    and status = 'waiting'
  for update;

  if not found then
    raise exception 'The game room is no longer available';
  end if;

  if not exists (
    select 1
    from public.room_players
    where room_id = v_room_id
      and user_id = v_uid
  ) then
    select count(*)::integer
      into v_player_count
    from public.room_players
    where room_id = v_room_id;

    if v_player_count >= coalesce(v_max_players, 8) then
      raise exception 'The game room is full';
    end if;

    insert into public.room_players (room_id, user_id, is_ready)
    values (v_room_id, v_uid, false);
  end if;

  update public.multiplayer_invites
  set status = 'accepted', responded_at = clock_timestamp()
  where id = _invite_id;

  return jsonb_build_object('status', 'accepted', 'room_id', v_room_id);
end;
$function$;

revoke all on function public.respond_multiplayer_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_multiplayer_invite(uuid, boolean) to authenticated;

-- Invite creation, response, and expiry are server-owned operations. Keep
-- authenticated SELECT for pending-invite recovery and Realtime authorization.
revoke all on table public.multiplayer_invites from public, anon, authenticated;
grant select on table public.multiplayer_invites to authenticated;
