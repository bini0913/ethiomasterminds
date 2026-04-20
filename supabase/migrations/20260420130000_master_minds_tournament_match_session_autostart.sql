-- Master Minds tournament: guarantee real multiplayer sessions start instantly for each live match.

-- Canonical tournament_progress object requested by product spec.
create table if not exists public.tournament_progress (
  tournament_id uuid primary key references public.tournaments(id) on delete cascade,
  current_round integer not null default 1,
  total_rounds integer not null default 1,
  updated_at timestamptz not null default now()
);

create or replace function public.sync_tournament_progress()
returns trigger
language plpgsql
as $$
declare
  v_tid uuid;
  v_max_round integer;
  v_total_rounds integer;
begin
  v_tid := coalesce(new.tournament_id, old.tournament_id);

  select coalesce(max(round), 1)
    into v_max_round
  from public.tournament_matches
  where tournament_id = v_tid;

  v_total_rounds := greatest(1, ceil(log(2, greatest(2, coalesce((select max_participants from public.tournaments where id = v_tid), 2))))::int);

  insert into public.tournament_progress (tournament_id, current_round, total_rounds, updated_at)
  values (v_tid, greatest(v_max_round, 1), v_total_rounds, now())
  on conflict (tournament_id)
  do update set
    current_round = excluded.current_round,
    total_rounds = excluded.total_rounds,
    updated_at = now();

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_tournament_progress on public.tournament_matches;
create trigger trg_sync_tournament_progress
after insert or update or delete on public.tournament_matches
for each row
execute function public.sync_tournament_progress();

create or replace function public.ensure_tournament_match_session(p_match_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.tournament_matches%rowtype;
  v_room_id uuid;
  v_subject text;
  v_mode text;
  v_question_count integer;
begin
  select * into v_match
  from public.tournament_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if v_match.player1_id is null or v_match.player2_id is null then
    raise exception 'Match requires two players before session can start';
  end if;

  select
    coalesce(subject, 'General'),
    coalesce(mode, 'speed'),
    coalesce(questions_per_match, question_count, questions_count, 10)
  into v_subject, v_mode, v_question_count
  from public.tournaments
  where id = v_match.tournament_id;

  if v_match.room_id is not null then
    begin
      v_room_id := v_match.room_id::uuid;
    exception
      when invalid_text_representation then
        v_room_id := null;
    end;
  end if;

  if v_room_id is null then
    insert into public.multiplayer_rooms (
      name,
      host_id,
      max_players,
      subject,
      difficulty,
      question_count,
      game_mode,
      status
    )
    values (
      format('Tournament R%s-M%s', coalesce(v_match.round, 1), coalesce(v_match.bracket_position, 1)),
      v_match.player1_id,
      2,
      v_subject,
      'medium',
      greatest(5, least(coalesce(v_question_count, 10), 30)),
      v_mode,
      'waiting'
    )
    returning id into v_room_id;

    update public.tournament_matches
    set room_id = v_room_id::text,
        meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('room_id', v_room_id),
        updated_at = now()
    where id = p_match_id;
  end if;

  insert into public.room_players (room_id, user_id, is_ready)
  values
    (v_room_id, v_match.player1_id, true),
    (v_room_id, v_match.player2_id, true)
  on conflict (room_id, user_id)
  do update set is_ready = true;

  return v_room_id;
end;
$$;

create or replace function public.start_tournament_match_session(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.tournament_matches%rowtype;
  v_room_id uuid;
begin
  select * into v_match
  from public.tournament_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  v_room_id := public.ensure_tournament_match_session(p_match_id);

  delete from public.room_answers where room_id = v_room_id;
  delete from public.room_questions where room_id = v_room_id;

  update public.room_players
  set score = 0,
      is_ready = true
  where room_id = v_room_id;

  insert into public.room_questions (room_id, question_id, order_index)
  select
    v_room_id,
    q.id,
    row_number() over (order by random()) - 1
  from public.questions q
  join public.quizzes qz on qz.id = q.quiz_id
  where qz.is_approved = true
    and (coalesce((select subject from public.tournaments where id = v_match.tournament_id), '') = '' or qz.subject = (select subject from public.tournaments where id = v_match.tournament_id))
  order by random()
  limit coalesce((select greatest(5, least(coalesce(questions_per_match, question_count, questions_count, 10), 30)) from public.tournaments where id = v_match.tournament_id), 10);

  insert into public.room_state (room_id, status, question_index, current_question_id, question_started_at, question_ends_at, updated_at)
  values (v_room_id, 'countdown', 0, null, null, now() + interval '5 seconds', now())
  on conflict (room_id)
  do update set
    status = 'countdown',
    question_index = 0,
    current_question_id = null,
    question_started_at = null,
    question_ends_at = now() + interval '5 seconds',
    updated_at = now();

  update public.multiplayer_rooms
  set status = 'playing',
      started_at = now(),
      finished_at = null,
      host_id = coalesce(v_match.player1_id, host_id)
  where id = v_room_id;

  update public.tournament_matches
  set status = 'playing',
      starts_at = coalesce(starts_at, now()),
      room_id = v_room_id::text,
      meta = coalesce(meta, '{}'::jsonb)
        || jsonb_build_object('room_id', v_room_id, 'auto_started', true, 'status', 'playing'),
      updated_at = now()
  where id = p_match_id;

  perform public.emit_tournament_event(
    v_match.tournament_id,
    'match_session_started',
    jsonb_build_object('match_id', p_match_id, 'room_id', v_room_id)
  );

  return jsonb_build_object('ok', true, 'room_id', v_room_id, 'match_id', p_match_id);
end;
$$;

create or replace function public.activate_waiting_matches_for_round(
  p_tournament_id uuid,
  p_round integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round integer;
  v_match record;
  v_started integer := 0;
begin
  if p_round is null then
    select min(round) into v_round
    from public.tournament_matches
    where tournament_id = p_tournament_id
      and status in ('waiting', 'ready');
  else
    v_round := p_round;
  end if;

  if v_round is null then
    return 0;
  end if;

  for v_match in
    select id
    from public.tournament_matches
    where tournament_id = p_tournament_id
      and round = v_round
      and status in ('waiting', 'ready')
      and player1_id is not null
      and player2_id is not null
  loop
    perform public.start_tournament_match_session(v_match.id);
    v_started := v_started + 1;
  end loop;

  return v_started;
end;
$$;

create or replace function public.manager_update_match_status(
  p_match_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.tournament_matches%rowtype;
  v_status text := lower(trim(p_status));
  v_room_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.has_role(v_uid, 'manager')
    or public.has_role(v_uid, 'admin')
    or public.has_role(v_uid, 'extreme_admin')
  ) then
    raise exception 'Only managers/admins can control matches';
  end if;

  if v_status not in ('waiting', 'playing', 'finished') then
    raise exception 'Status must be waiting, playing, or finished';
  end if;

  select * into v_match
  from public.tournament_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if v_status = 'playing' then
    select (public.start_tournament_match_session(p_match_id)->>'room_id')::uuid into v_room_id;
  else
    update public.tournament_matches
    set status = case when v_status = 'waiting' then 'waiting' else 'finished' end,
        starts_at = case when v_status = 'waiting' then null else starts_at end,
        finished_at = case when v_status = 'finished' then coalesce(finished_at, now()) else null end,
        updated_at = now()
    where id = p_match_id;
  end if;

  perform public.emit_tournament_event(
    v_match.tournament_id,
    case when v_status = 'playing' then 'match_start' when v_status = 'finished' then 'match_end' else 'match_waiting' end,
    jsonb_build_object('match_id', p_match_id, 'status', v_status, 'room_id', v_room_id)
  );

  perform public.log_tournament_action(
    v_match.tournament_id,
    'manager_match_status',
    v_uid,
    jsonb_build_object('match_id', p_match_id, 'status', v_status, 'room_id', v_room_id)
  );

  return jsonb_build_object('ok', true, 'match_id', p_match_id, 'status', v_status, 'room_id', v_room_id);
end;
$$;

-- Auto-run live sessions as soon as a waiting match is inserted for an active tournament.
create or replace function public.auto_start_tournament_match_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_status text;
begin
  if new.player1_id is null or new.player2_id is null then
    return new;
  end if;

  select status into v_tournament_status from public.tournaments where id = new.tournament_id;

  if coalesce(v_tournament_status, '') in ('active', 'starting', 'next_round') and new.status in ('waiting', 'ready') then
    perform public.start_tournament_match_session(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auto_start_tournament_match_on_insert on public.tournament_matches;
create trigger trg_auto_start_tournament_match_on_insert
after insert on public.tournament_matches
for each row
execute function public.auto_start_tournament_match_on_insert();

-- When managers resume/activate a tournament, immediately open live rooms for the first waiting round.
create or replace function public.manager_set_tournament_status(
  p_tournament_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text := lower(trim(p_status));
  v_started_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.has_role(v_uid, 'manager')
    or public.has_role(v_uid, 'admin')
    or public.has_role(v_uid, 'extreme_admin')
  ) then
    raise exception 'Only managers/admins can control tournament status';
  end if;

  if v_status not in ('waiting', 'starting', 'active', 'finished', 'cancelled') then
    raise exception 'Unsupported tournament status: %', p_status;
  end if;

  update public.tournaments
  set status = v_status,
      paused_at = case when v_status = 'waiting' then now() else paused_at end,
      updated_at = now()
  where id = p_tournament_id;

  if v_status = 'active' then
    v_started_count := public.activate_waiting_matches_for_round(p_tournament_id);
  end if;

  perform public.emit_tournament_event(
    p_tournament_id,
    case when v_status = 'active' then 'resume' when v_status = 'waiting' then 'pause' else 'status_update' end,
    jsonb_build_object('status', v_status, 'started_matches', v_started_count)
  );

  perform public.log_tournament_action(
    p_tournament_id,
    'manager_tournament_status',
    v_uid,
    jsonb_build_object('status', v_status, 'started_matches', v_started_count)
  );

  return jsonb_build_object('ok', true, 'status', v_status, 'started_matches', v_started_count);
end;
$$;

revoke all on function public.ensure_tournament_match_session(uuid) from public;
revoke all on function public.start_tournament_match_session(uuid) from public;
revoke all on function public.activate_waiting_matches_for_round(uuid, integer) from public;

grant execute on function public.ensure_tournament_match_session(uuid) to authenticated;
grant execute on function public.start_tournament_match_session(uuid) to authenticated;
grant execute on function public.activate_waiting_matches_for_round(uuid, integer) to authenticated;
