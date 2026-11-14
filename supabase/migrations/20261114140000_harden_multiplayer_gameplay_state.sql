-- Close gameplay-state gaps found during the post-hardening client/RPC audit.
-- All changes are forward-only; previously applied migrations remain untouched.

create or replace function public.multiplayer_advance_player(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth
as $function$
declare
  r public.multiplayer_rooms%rowtype;
  p public.room_players%rowtype;
  v_question_id uuid;
  v_total integer;
  v_next integer;
  v_all_done boolean;
  v_answered boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into r
  from public.multiplayer_rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Room not found';
  end if;
  if r.status <> 'playing' then
    raise exception 'Match is not playing';
  end if;
  if r.game_mode <> 'accuracy' then
    raise exception 'Manual question advancement is only available in accuracy mode';
  end if;

  select * into p
  from public.room_players
  where room_id = p_room_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Not a room player';
  end if;

  if p.completed_at is not null then
    return jsonb_build_object('done', true, 'completed', true, 'index', p.current_question_index);
  end if;

  select count(*)::integer into v_total
  from public.room_questions
  where room_id = p_room_id;

  if v_total = 0 then
    raise exception 'No questions configured for this room';
  end if;

  select question_id into v_question_id
  from public.room_questions
  where room_id = p_room_id
    and order_index = p.current_question_index;

  if not found then
    raise exception 'Current question assignment is missing';
  end if;

  select exists (
    select 1
    from public.room_answers
    where room_id = p_room_id
      and user_id = auth.uid()
      and question_id = v_question_id
  ) into v_answered;

  if not v_answered and (
    p.question_started_at is null
    or clock_timestamp() < p.question_started_at + interval '30 seconds'
  ) then
    raise exception 'Answer the current question or wait for the timer to expire';
  end if;

  v_next := p.current_question_index + 1;

  if v_next >= v_total then
    update public.room_players
    set current_question_index = v_next,
        completed_at = clock_timestamp(),
        question_started_at = null
    where id = p.id;

    select not exists (
      select 1
      from public.room_players
      where room_id = p_room_id
        and completed_at is null
    ) into v_all_done;

    if v_all_done then
      update public.multiplayer_rooms
      set status = 'finished',
          finished_at = coalesce(finished_at, clock_timestamp())
      where id = p_room_id and status = 'playing';

      update public.room_state
      set status = 'finished',
          updated_at = clock_timestamp()
      where room_id = p_room_id;
    end if;

    return jsonb_build_object('done', true, 'completed', true, 'index', v_next, 'total', v_total);
  end if;

  update public.room_players
  set current_question_index = v_next,
      question_started_at = clock_timestamp()
  where id = p.id;

  return public.multiplayer_question_payload(p_room_id, v_next);
end;
$function$;

create or replace function public.multiplayer_question_payload(p_room_id uuid, p_order_index integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth
as $function$
declare
  q record;
  n integer;
  v_status text;
  v_player_index integer;
  v_completed_at timestamptz;
  started_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select status into v_status
  from public.multiplayer_rooms
  where id = p_room_id;

  if not found or v_status <> 'playing' then
    raise exception 'Match is not playing';
  end if;

  select current_question_index, completed_at, question_started_at
  into v_player_index, v_completed_at, started_at
  from public.room_players
  where room_id = p_room_id and user_id = auth.uid();

  if not found then
    raise exception 'Not a room player';
  end if;
  if v_completed_at is not null or v_player_index <> p_order_index then
    raise exception 'Question is not assigned to this player';
  end if;

  select count(*)::integer into n
  from public.room_questions
  where room_id = p_room_id;

  select x.id, x.question_text, x.options, x.points, r.order_index
  into q
  from public.room_questions r
  join public.questions x on x.id = r.question_id
  where r.room_id = p_room_id and r.order_index = p_order_index
  limit 1;

  if not found then
    raise exception 'Question assignment is missing';
  end if;

  return jsonb_build_object(
    'done', false,
    'id', q.id,
    'question_text', q.question_text,
    'options', q.options,
    'points', coalesce(q.points, 100),
    'index', q.order_index,
    'total', n,
    'question_started_at', started_at
  );
end;
$function$;

create or replace function public.multiplayer_finish_game(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, auth
as $function$
declare
  r public.multiplayer_rooms%rowtype;
  should_finish boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into r
  from public.multiplayer_rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Room not found';
  end if;

  if not exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = auth.uid()
  ) then
    raise exception 'Not a room player';
  end if;

  if r.status = 'finished' then
    return true;
  end if;
  if r.status <> 'playing' then
    return false;
  end if;

  if r.game_mode = 'speed'
     and r.started_at is not null
     and clock_timestamp() >= r.started_at + interval '1 minute' then
    should_finish := true;
  elsif r.game_mode = 'accuracy' then
    -- A single completed player must never be able to end everyone else's match.
    should_finish := not exists (
      select 1
      from public.room_players
      where room_id = p_room_id and completed_at is null
    );
  end if;

  if should_finish then
    update public.multiplayer_rooms
    set status = 'finished',
        finished_at = coalesce(finished_at, clock_timestamp())
    where id = p_room_id and status = 'playing';

    update public.room_state
    set status = 'finished',
        updated_at = clock_timestamp()
    where room_id = p_room_id;

    return true;
  end if;

  return false;
end;
$function$;

create or replace function public.multiplayer_toggle_ready(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_ready boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select status into v_status
  from public.multiplayer_rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Room not found';
  end if;
  if v_status <> 'waiting' then
    raise exception 'Room is not accepting readiness changes';
  end if;

  select is_ready into v_ready
  from public.room_players
  where room_id = p_room_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'You are not in this room';
  end if;

  update public.room_players
  set is_ready = not coalesce(v_ready, false)
  where room_id = p_room_id and user_id = v_uid;

  return not coalesce(v_ready, false);
end;
$function$;

create or replace function public.multiplayer_kick_player(p_room_id uuid, p_player_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_status text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select host_id, status into v_host, v_status
  from public.multiplayer_rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Room not found';
  end if;
  if v_host <> v_uid then
    raise exception 'Only the host can remove players';
  end if;
  if v_status <> 'waiting' then
    raise exception 'Players can only be removed before the match starts';
  end if;
  if p_player_id = v_uid then
    raise exception 'Host cannot kick themselves';
  end if;

  delete from public.room_players
  where room_id = p_room_id and user_id = p_player_id;

  return found;
end;
$function$;
