-- Multiplayer invite reliability, host controls, and difficulty-aware question selection.

drop function if exists public.respond_multiplayer_invite(uuid, boolean);

create or replace function public.create_multiplayer_invite(_room_id uuid, _receiver_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_status text;
  v_max_players integer;
  v_player_count integer;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if _receiver_id is null or _receiver_id = v_uid then raise exception 'Invalid invite recipient'; end if;

  select host_id, status, max_players into v_host, v_status, v_max_players
  from public.multiplayer_rooms where id = _room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_host <> v_uid then raise exception 'Only the host can invite players'; end if;
  if v_status <> 'waiting' then raise exception 'Invites are only available while the room is waiting'; end if;

  select count(*)::integer into v_player_count from public.room_players where room_id = _room_id;
  if v_player_count >= coalesce(v_max_players, 8) then raise exception 'Room is full'; end if;

  if exists (select 1 from public.room_players where room_id = _room_id and user_id = _receiver_id) then
    raise exception 'Player is already in this room';
  end if;

  if exists (
    select 1 from public.multiplayer_invites
    where room_id = _room_id and receiver_id = _receiver_id
      and status = 'pending' and expires_at > now()
  ) then
    raise exception 'An active invite already exists for this player';
  end if;

  insert into public.multiplayer_invites (room_id, sender_id, receiver_id, status, expires_at)
  values (_room_id, v_uid, _receiver_id, 'pending', now() + interval '2 minutes')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_multiplayer_invite(uuid, uuid) from public, anon;
grant execute on function public.create_multiplayer_invite(uuid, uuid) to authenticated;

create or replace function public.respond_multiplayer_invite(_invite_id uuid, _accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room_id uuid;
  v_status text;
  v_expires_at timestamptz;
  v_max_players integer;
  v_player_count integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select room_id, status, expires_at into v_room_id, v_status, v_expires_at
  from public.multiplayer_invites
  where id = _invite_id and receiver_id = v_uid
  for update;

  if not found then raise exception 'Invite not found'; end if;
  if v_status <> 'pending' then raise exception 'Invite is no longer pending'; end if;

  if v_expires_at <= now() then
    update public.multiplayer_invites set status = 'expired', responded_at = now() where id = _invite_id;
    raise exception 'Invite has expired';
  end if;

  if not _accept then
    update public.multiplayer_invites set status = 'rejected', responded_at = now() where id = _invite_id;
    return jsonb_build_object('status', 'rejected', 'room_id', v_room_id);
  end if;

  select max_players into v_max_players
  from public.multiplayer_rooms where id = v_room_id and status = 'waiting' for update;
  if not found then raise exception 'The game room is no longer available'; end if;

  select count(*)::integer into v_player_count from public.room_players where room_id = v_room_id;
  if v_player_count >= coalesce(v_max_players, 8) then raise exception 'The game room is full'; end if;

  update public.multiplayer_invites set status = 'accepted', responded_at = now() where id = _invite_id;
  return jsonb_build_object('status', 'accepted', 'room_id', v_room_id);
end;
$$;

revoke all on function public.respond_multiplayer_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_multiplayer_invite(uuid, boolean) to authenticated;

create or replace function public.multiplayer_update_room(
  p_room_id uuid, p_subject text, p_difficulty text, p_game_mode text,
  p_question_count integer, p_max_players integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_current_players integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_question_count is null or p_question_count < 1 or p_question_count > 50 then
    raise exception 'Question count must be between 1 and 50';
  end if;
  if p_max_players is null or p_max_players < 2 or p_max_players > 8 then
    raise exception 'Player count must be between 2 and 8';
  end if;

  select host_id into v_host
  from public.multiplayer_rooms where id = p_room_id and status = 'waiting' for update;
  if not found then raise exception 'Room not found or already started'; end if;
  if v_host <> v_uid then raise exception 'Only the host can update room settings'; end if;

  select count(*)::integer into v_current_players from public.room_players where room_id = p_room_id;
  if p_max_players < v_current_players then
    raise exception 'Player limit cannot be lower than the players already in the room';
  end if;

  update public.multiplayer_rooms
  set subject = coalesce(nullif(trim(p_subject), ''), 'Mixed'),
      difficulty = coalesce(nullif(trim(p_difficulty), ''), 'Medium'),
      game_mode = case when lower(coalesce(p_game_mode, 'accuracy')) in ('speed','one_minute','1_minute')
                       then 'speed' else 'accuracy' end,
      question_count = p_question_count,
      max_players = p_max_players
  where id = p_room_id;
  return true;
end;
$$;

revoke all on function public.multiplayer_update_room(uuid, text, text, text, integer, integer) from public, anon;
grant execute on function public.multiplayer_update_room(uuid, text, text, text, integer, integer) to authenticated;

create or replace function public.multiplayer_start_game(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r public.multiplayer_rooms%rowtype;
  uid uuid := auth.uid();
  n int;
  mode text;
  selected_count int;
begin
  select * into r from public.multiplayer_rooms where id = p_room_id for update;
  if uid is null then raise exception 'Authentication required'; end if;
  if not found then raise exception 'Room not found'; end if;
  if r.host_id <> uid then raise exception 'Only the host can start the game'; end if;
  if r.status not in ('waiting','countdown') then raise exception 'Room is already started or finished'; end if;
  if (select count(*) from public.room_players where room_id = p_room_id) < 2 then raise exception 'At least 2 players are required'; end if;
  if exists(select 1 from public.room_players where room_id = p_room_id and user_id <> r.host_id and coalesce(is_ready,false) = false) then
    raise exception 'All other players must be ready before the host starts';
  end if;

  mode := case when lower(coalesce(r.game_mode,'accuracy')) in ('speed','one_minute','1_minute') then 'speed' else 'accuracy' end;
  n := case when mode = 'speed' then 50 else greatest(1, least(coalesce(r.question_count,10),50)) end;

  delete from public.room_answers where room_id = p_room_id;
  delete from public.room_questions where room_id = p_room_id;

  insert into public.room_questions(room_id, question_id, order_index)
  select p_room_id, q.id, row_number() over(order by random()) - 1
  from public.questions q
  join public.quizzes z on z.id = q.quiz_id
  where z.is_approved = true
    and (
      lower(trim(coalesce(r.subject,'mixed'))) = 'mixed'
      or lower(trim(coalesce(q.subject,''))) = lower(trim(coalesce(r.subject,'mixed')))
      or (lower(trim(coalesce(r.subject,''))) in ('math','mathematics')
          and lower(trim(coalesce(q.subject,''))) in ('math','mathematics'))
    )
    and (
      lower(trim(coalesce(r.difficulty,'medium'))) = 'mixed'
      or lower(trim(coalesce(q.difficulty,''))) = lower(trim(coalesce(r.difficulty,'medium')))
      or lower(trim(coalesce(z.difficulty,''))) = lower(trim(coalesce(r.difficulty,'medium')))
    )
  order by random() limit n;

  select count(*)::int into selected_count from public.room_questions where room_id = p_room_id;

  if selected_count < n then
    delete from public.room_questions where room_id = p_room_id;
    insert into public.room_questions(room_id, question_id, order_index)
    select p_room_id, q.id, row_number() over(order by random()) - 1
    from public.questions q
    join public.quizzes z on z.id = q.quiz_id
    where z.is_approved = true
      and (
        lower(trim(coalesce(r.subject,'mixed'))) = 'mixed'
        or lower(trim(coalesce(q.subject,''))) = lower(trim(coalesce(r.subject,'mixed')))
        or (lower(trim(coalesce(r.subject,''))) in ('math','mathematics')
            and lower(trim(coalesce(q.subject,''))) in ('math','mathematics'))
      )
    order by random() limit n;
  end if;

  select count(*)::int into selected_count from public.room_questions where room_id = p_room_id;

  if selected_count = 0 then
    insert into public.room_questions(room_id, question_id, order_index)
    select p_room_id, q.id, row_number() over(order by random()) - 1
    from public.questions q join public.quizzes z on z.id = q.quiz_id
    where z.is_approved = true
    order by random() limit n;
  end if;

  if not exists(select 1 from public.room_questions where room_id = p_room_id) then
    raise exception 'No approved questions are available for multiplayer';
  end if;

  update public.multiplayer_rooms
  set status = 'playing', started_at = clock_timestamp(), finished_at = null,
      current_question = 0,
      question_count = (select count(*) from public.room_questions where room_id = p_room_id),
      game_mode = mode
  where id = p_room_id;

  update public.room_players
  set score = 0, current_question_index = 0, answered_count = 0, correct_count = 0, completed_at = null
  where room_id = p_room_id;

  insert into public.room_state(room_id,status,question_index,current_question_id,question_started_at,question_ends_at)
  values(p_room_id,'playing',0,null,null,null)
  on conflict(room_id) do update set
    status='playing', question_index=0, current_question_id=null,
    question_started_at=null, question_ends_at=null, updated_at=clock_timestamp();

  return jsonb_build_object(
    'status','playing', 'game_mode',mode,
    'question_count',(select count(*) from public.room_questions where room_id=p_room_id),
    'started_at',(select started_at from public.multiplayer_rooms where id=p_room_id)
  );
end;
$function$;

notify pgrst, 'reload schema';
