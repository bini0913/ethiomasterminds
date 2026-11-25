-- Close the remaining public-room bypass in user blocking.
-- Invite and Study Mode RPCs already reject blocked pairs; these room join/chat
-- SECURITY DEFINER paths also need an explicit database-boundary check.

create or replace function public.multiplayer_join_room(
  p_room_id uuid,
  p_password text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, auth
as $$
declare
  v_uid uuid := (select auth.uid());
  v_room public.multiplayer_rooms%rowtype;
  v_password_hash text;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if octet_length(coalesce(p_password, '')) > 256 then
    raise exception 'Room password is too long';
  end if;

  select * into v_room
  from public.multiplayer_rooms
  where id = p_room_id
  for update;

  if not found or v_room.status not in ('waiting', 'countdown', 'playing') then
    raise exception 'Room is no longer available';
  end if;

  -- Check before the reconnect shortcut too: a block may have been added
  -- after this player originally joined the room.
  if exists (
    select 1
    from public.room_players existing
    where existing.room_id = p_room_id
      and existing.user_id <> v_uid
      and public.are_users_blocked(v_uid, existing.user_id)
  ) then
    raise exception 'This room contains someone you cannot interact with';
  end if;

  if exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = v_uid
  ) then
    return true;
  end if;

  if v_room.status = 'playing' then
    raise exception 'This match has already started';
  end if;

  select password_hash into v_password_hash
  from public.multiplayer_room_secrets
  where room_id = p_room_id;

  if v_password_hash is not null
     and extensions.crypt(encode(extensions.digest(coalesce(p_password, ''), 'sha256'), 'hex'), v_password_hash) <> v_password_hash then
    raise exception 'Incorrect password';
  end if;

  select count(*)::integer into v_count
  from public.room_players
  where room_id = p_room_id;

  if v_count >= v_room.max_players then
    raise exception 'Room is full';
  end if;

  insert into public.room_players (room_id, user_id, is_ready)
  values (p_room_id, v_uid, false);

  return true;
end;
$$;

create or replace function public.multiplayer_ensure_membership(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_max integer;
  v_count integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select status, max_players into v_status, v_max
  from public.multiplayer_rooms
  where id = p_room_id
  for update;
  if not found then raise exception 'Room not found'; end if;
  if v_status not in ('waiting', 'countdown', 'playing') then
    raise exception 'Room is no longer active';
  end if;

  if exists (
    select 1
    from public.room_players existing
    where existing.room_id = p_room_id
      and existing.user_id <> v_uid
      and public.are_users_blocked(v_uid, existing.user_id)
  ) then
    raise exception 'This room contains someone you cannot interact with';
  end if;

  if exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = v_uid
  ) then
    return true;
  end if;

  select count(*) into v_count
  from public.room_players
  where room_id = p_room_id;
  if v_count >= v_max then raise exception 'Room is full'; end if;

  insert into public.room_players(room_id, user_id, is_ready)
  values(p_room_id, v_uid, false);
  return true;
end;
$$;

create or replace function public.multiplayer_send_room_message(
  p_room_id uuid,
  p_content text
)
returns public.room_chat_messages
language plpgsql
security definer
set search_path = pg_catalog, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_message public.room_chat_messages%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = v_uid
  ) then
    raise exception 'You are not in this room';
  end if;
  if exists (
    select 1
    from public.room_players existing
    where existing.room_id = p_room_id
      and existing.user_id <> v_uid
      and public.are_users_blocked(v_uid, existing.user_id)
  ) then
    raise exception 'This room contains someone you cannot interact with';
  end if;
  if trim(coalesce(p_content, '')) = '' then
    raise exception 'Message cannot be empty';
  end if;

  insert into public.room_chat_messages(room_id, user_id, content)
  values(p_room_id, v_uid, left(trim(p_content), 80))
  returning * into v_message;
  return v_message;
end;
$$;

create or replace function public.enforce_guardian_room_player_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.user_id <> auth.uid() then
    raise exception 'You can only join a room as your own account';
  end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.user_id, 'multiplayer') then
    raise exception 'Multiplayer is disabled by parent or guardian settings';
  end if;
  if exists (
    select 1
    from public.room_players existing
    where existing.room_id = new.room_id
      and existing.user_id <> new.user_id
      and public.are_users_blocked(new.user_id, existing.user_id)
  ) then
    raise exception 'This room contains someone you cannot interact with';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_guardian_room_chat_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.user_id <> auth.uid() then
    raise exception 'You can only send room chat from your own account';
  end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.user_id, 'multiplayer')
     or not public.is_user_feature_enabled(new.user_id, 'social') then
    raise exception 'Room chat is disabled by parent or guardian settings';
  end if;
  if not public.is_multiplayer_room_member(new.room_id) then
    raise exception 'You must be a room member to send chat';
  end if;
  if exists (
    select 1
    from public.room_players existing
    where existing.room_id = new.room_id
      and existing.user_id <> new.user_id
      and public.are_users_blocked(new.user_id, existing.user_id)
  ) then
    raise exception 'This room contains someone you cannot interact with';
  end if;
  return new;
end;
$$;

revoke all on function public.multiplayer_join_room(uuid, text) from public, anon;
grant execute on function public.multiplayer_join_room(uuid, text) to authenticated;
revoke all on function public.multiplayer_ensure_membership(uuid) from public, anon;
grant execute on function public.multiplayer_ensure_membership(uuid) to authenticated;
revoke all on function public.multiplayer_send_room_message(uuid, text) from public, anon;
grant execute on function public.multiplayer_send_room_message(uuid, text) to authenticated;

revoke all on function public.enforce_guardian_room_player_permissions() from public, anon, authenticated;
revoke all on function public.enforce_guardian_room_chat_permissions() from public, anon, authenticated;
