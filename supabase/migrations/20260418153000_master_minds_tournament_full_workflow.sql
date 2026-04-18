-- Master Minds: full tournament workflow (manager creation, timed start, registration deadline, forfeit handling)

alter table public.tournaments add column if not exists registration_deadline timestamptz;
alter table public.tournaments add column if not exists questions_per_match integer;

update public.tournaments
set registration_deadline = coalesce(registration_deadline, starts_at, start_time)
where registration_deadline is null;

update public.tournaments
set questions_per_match = coalesce(questions_per_match, question_count, questions_count, 10)
where questions_per_match is null;

create or replace function public.start_tournament_now(p_tournament_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_players uuid[];
  v_player_count integer;
  v_slot_count integer := 1;
  i integer;
  v_player1 uuid;
  v_player2 uuid;
begin
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_tournament.status in ('active', 'finished', 'completed', 'cancelled') then
    return false;
  end if;

  select array_agg(tp.user_id order by random()) into v_players
  from public.tournament_players tp
  where tp.tournament_id = p_tournament_id
    and tp.status = 'active';

  v_player_count := coalesce(array_length(v_players, 1), 0);

  if v_player_count < 2 then
    return false;
  end if;

  while v_slot_count * 2 <= v_player_count loop
    v_slot_count := v_slot_count * 2;
  end loop;

  if v_slot_count < 2 then
    return false;
  end if;

  delete from public.tournament_matches where tournament_id = p_tournament_id;

  update public.tournaments
  set status = 'active',
      starts_at = coalesce(starts_at, now()),
      start_time = coalesce(start_time, now()),
      updated_at = now()
  where id = p_tournament_id;

  for i in 1..(v_slot_count / 2) loop
    v_player1 := v_players[(i * 2) - 1];
    v_player2 := v_players[i * 2];

    insert into public.tournament_matches (
      tournament_id,
      round,
      round_number,
      bracket_position,
      status,
      player1_id,
      player2_id,
      meta
    )
    values (
      p_tournament_id,
      1,
      1,
      i,
      'waiting',
      v_player1,
      v_player2,
      jsonb_build_object('mode', coalesce(v_tournament.mode, 'speed'), 'questions_per_match', coalesce(v_tournament.questions_per_match, v_tournament.question_count, 10))
    );
  end loop;

  perform public.emit_tournament_event(
    p_tournament_id,
    'tournament_started',
    jsonb_build_object('round', 1, 'match_count', v_slot_count / 2, 'players_seeded', v_slot_count)
  );

  return true;
end;
$$;

create or replace function public.auto_start_due_tournaments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started integer := 0;
  v_row record;
begin
  for v_row in
    select id
    from public.tournaments
    where status in ('waiting', 'upcoming', 'starting')
      and coalesce(starts_at, start_time) is not null
      and now() >= coalesce(starts_at, start_time)
  loop
    if public.start_tournament_now(v_row.id) then
      v_started := v_started + 1;
    end if;
  end loop;

  return v_started;
end;
$$;

create or replace function public.create_tournament_workflow(
  p_name text,
  p_mode text,
  p_subject text,
  p_max_players integer,
  p_questions_per_match integer,
  p_start_time timestamptz,
  p_registration_deadline timestamptz,
  p_entry_fee integer default 0
)
returns public.tournaments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mode text := lower(trim(coalesce(p_mode, 'speed')));
  v_tournament public.tournaments%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not (public.has_role(v_uid, 'manager') or public.has_role(v_uid, 'admin') or public.has_role(v_uid, 'extreme_admin')) then
    raise exception 'Only managers/admins can create tournaments';
  end if;

  if p_max_players not in (8, 16, 32) then
    raise exception 'Player count must be 8, 16, or 32';
  end if;

  if v_mode not in ('speed', 'accuracy') then
    raise exception 'Mode must be speed or accuracy';
  end if;

  if p_registration_deadline >= p_start_time then
    raise exception 'Registration deadline must be before start time';
  end if;

  insert into public.tournaments (
    name,
    title,
    status,
    max_participants,
    max_players,
    current_players,
    subject,
    mode,
    questions_count,
    question_count,
    questions_per_match,
    starts_at,
    start_time,
    registration_deadline,
    end_time,
    ends_at,
    entry_fee,
    entry_fee_coins,
    entry_cost,
    settings,
    created_by,
    prize_coins
  )
  values (
    p_name,
    p_name,
    'waiting',
    p_max_players,
    p_max_players,
    0,
    p_subject,
    v_mode,
    p_questions_per_match,
    p_questions_per_match,
    p_questions_per_match,
    p_start_time,
    p_start_time,
    p_registration_deadline,
    p_start_time + interval '2 hours',
    p_start_time + interval '2 hours',
    greatest(p_entry_fee, 0),
    greatest(p_entry_fee, 0),
    greatest(p_entry_fee, 0),
    jsonb_build_object(
      'mode', v_mode,
      'subject', p_subject,
      'max_players', p_max_players,
      'questions_per_match', p_questions_per_match,
      'start_time', p_start_time,
      'registration_deadline', p_registration_deadline
    ),
    v_uid,
    1500
  )
  returning * into v_tournament;

  perform public.emit_tournament_event(v_tournament.id, 'tournament_created', jsonb_build_object('name', p_name, 'mode', v_mode));
  perform public.log_tournament_action(v_tournament.id, 'tournament_created', v_uid, jsonb_build_object('name', p_name, 'mode', v_mode));

  return v_tournament;
end;
$$;

create or replace function public.join_tournament(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament public.tournaments%rowtype;
  v_fee integer;
  v_wallet public.wallets%rowtype;
  v_started boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  perform public.auto_start_due_tournaments();

  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_tournament.registration_deadline is not null and now() > v_tournament.registration_deadline then
    raise exception 'Registration deadline has passed';
  end if;

  if v_tournament.status not in ('waiting', 'starting', 'upcoming') then
    raise exception 'Tournament already started or closed';
  end if;

  if exists (
    select 1 from public.tournament_players
    where tournament_id = p_tournament_id and user_id = v_uid
  ) then
    raise exception 'Already joined this tournament';
  end if;

  if coalesce(v_tournament.current_players, 0) >= coalesce(v_tournament.max_participants, v_tournament.max_players, 0) then
    raise exception 'Tournament is full';
  end if;

  v_fee := coalesce(v_tournament.entry_fee, v_tournament.entry_fee_coins, v_tournament.entry_cost, 0);
  if v_fee > 0 then
    perform public.ensure_wallet(v_uid);
    select * into v_wallet from public.wallets where user_id = v_uid for update;

    if v_wallet.coins < v_fee then
      raise exception 'Insufficient coins for entry fee';
    end if;

    update public.wallets
    set coins = coins - v_fee
    where user_id = v_uid;

    insert into public.transactions(sender_id, receiver_id, amount, type, source)
    values (v_uid, null, v_fee, 'tournament_entry', format('tournament:%s', p_tournament_id));
  end if;

  insert into public.tournament_players(
    tournament_id,
    user_id,
    status,
    join_status
  )
  values (
    p_tournament_id,
    v_uid,
    'active',
    'active'
  );

  perform public.recount_tournament_players(p_tournament_id);

  perform public.emit_tournament_event(
    p_tournament_id,
    'player_joined',
    jsonb_build_object('user_id', v_uid, 'entry_fee', v_fee)
  );

  if now() >= coalesce(v_tournament.starts_at, v_tournament.start_time, now() + interval '10 years') then
    v_started := public.start_tournament_now(p_tournament_id);
  else
    v_started := public.start_tournament_if_full(p_tournament_id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'auto_started', v_started,
    'tournament_id', p_tournament_id
  );
end;
$$;

create or replace function public.manager_mark_match_forfeit(
  p_match_id uuid,
  p_absent_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.tournament_matches%rowtype;
  v_winner uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.has_role(v_uid, 'manager')
    or public.has_role(v_uid, 'admin')
    or public.has_role(v_uid, 'extreme_admin')
  ) then
    raise exception 'Only managers/admins can apply forfeits';
  end if;

  select * into v_match
  from public.tournament_matches
  where id = p_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if p_absent_user_id not in (v_match.player1_id, v_match.player2_id) then
    raise exception 'Absent user must be one of the match players';
  end if;

  v_winner := case when v_match.player1_id = p_absent_user_id then v_match.player2_id else v_match.player1_id end;

  return public.complete_match_and_progress(
    p_match_id,
    v_winner,
    case when v_match.player1_id = v_winner then 1 else 0 end,
    case when v_match.player2_id = v_winner then 1 else 0 end,
    true
  );
end;
$$;

revoke all on function public.create_tournament_workflow(text, text, text, integer, integer, timestamptz, timestamptz, integer) from public;
revoke all on function public.auto_start_due_tournaments() from public;
revoke all on function public.start_tournament_now(uuid) from public;
revoke all on function public.manager_mark_match_forfeit(uuid, uuid) from public;

grant execute on function public.create_tournament_workflow(text, text, text, integer, integer, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.auto_start_due_tournaments() to authenticated;
grant execute on function public.start_tournament_now(uuid) to authenticated;
grant execute on function public.manager_mark_match_forfeit(uuid, uuid) to authenticated;
