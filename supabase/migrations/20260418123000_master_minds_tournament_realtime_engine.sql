-- Master Minds tournament engine hardening
-- Adds strict data model aliases + manager control RPCs + realtime/log streams.

-- Canonical tournament column aliases required by product spec
alter table public.tournaments add column if not exists question_count integer;
alter table public.tournaments add column if not exists paused_at timestamptz;

update public.tournaments
set question_count = coalesce(question_count, questions_count)
where question_count is null;

-- Keep legacy and canonical question count columns synchronized
create or replace function public.sync_tournament_question_count()
returns trigger
language plpgsql
as $$
begin
  if new.question_count is null and new.questions_count is not null then
    new.question_count := new.questions_count;
  elsif new.questions_count is null and new.question_count is not null then
    new.questions_count := new.question_count;
  else
    new.question_count := coalesce(new.question_count, new.questions_count, 10);
    new.questions_count := new.question_count;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_tournament_question_count on public.tournaments;
create trigger trg_sync_tournament_question_count
before insert or update on public.tournaments
for each row
execute function public.sync_tournament_question_count();

-- Round number alias on tournament_matches for API/UI compatibility
alter table public.tournament_matches add column if not exists round_number integer;

update public.tournament_matches
set round_number = round
where round_number is null;

create or replace function public.sync_match_round_number()
returns trigger
language plpgsql
as $$
begin
  if new.round_number is null and new.round is not null then
    new.round_number := new.round;
  elsif new.round is null and new.round_number is not null then
    new.round := new.round_number;
  else
    new.round_number := coalesce(new.round_number, new.round, 1);
    new.round := new.round_number;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_match_round_number on public.tournament_matches;
create trigger trg_sync_match_round_number
before insert or update on public.tournament_matches
for each row
execute function public.sync_match_round_number();

-- Dedicated bracket table for explicit UI mapping (optional in product, but provided here)
create table if not exists public.brackets (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number integer not null check (round_number >= 1),
  match_id uuid not null references public.tournament_matches(id) on delete cascade,
  position integer not null,
  created_at timestamptz not null default now(),
  unique (tournament_id, round_number, position),
  unique (match_id)
);

create index if not exists idx_brackets_tournament_round on public.brackets(tournament_id, round_number, position);
alter table public.brackets enable row level security;

drop policy if exists "Brackets are readable by authenticated users" on public.brackets;
create policy "Brackets are readable by authenticated users"
  on public.brackets
  for select
  using (auth.uid() is not null);

-- Keep brackets in sync with tournament_matches
create or replace function public.sync_bracket_from_match()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.brackets where match_id = old.id;
    return old;
  end if;

  insert into public.brackets (tournament_id, round_number, match_id, position)
  values (new.tournament_id, coalesce(new.round_number, new.round), new.id, coalesce(new.bracket_position, 1))
  on conflict (match_id) do update
    set tournament_id = excluded.tournament_id,
        round_number = excluded.round_number,
        position = excluded.position;

  return new;
end;
$$;

drop trigger if exists trg_sync_bracket_from_match on public.tournament_matches;
create trigger trg_sync_bracket_from_match
after insert or update or delete on public.tournament_matches
for each row
execute function public.sync_bracket_from_match();

-- Ensure event payload alias column exists exactly as product requested (data json)
alter table public.tournament_events add column if not exists data jsonb;

update public.tournament_events
set data = coalesce(data, payload, '{}'::jsonb)
where data is null;

alter table public.tournament_events alter column data set default '{}'::jsonb;
alter table public.tournament_events alter column data set not null;

create or replace function public.sync_tournament_event_payload()
returns trigger
language plpgsql
as $$
begin
  new.payload := coalesce(new.payload, new.data, '{}'::jsonb);
  new.data := coalesce(new.data, new.payload, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists trg_sync_tournament_event_payload on public.tournament_events;
create trigger trg_sync_tournament_event_payload
before insert or update on public.tournament_events
for each row
execute function public.sync_tournament_event_payload();

-- Manager action audit stream
create table if not exists public.tournament_logs (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  action text not null,
  performed_by uuid references public.profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tournament_logs_tid_created on public.tournament_logs(tournament_id, created_at desc);
alter table public.tournament_logs enable row level security;

drop policy if exists "Tournament logs are readable by managers and admins" on public.tournament_logs;
create policy "Tournament logs are readable by managers and admins"
  on public.tournament_logs
  for select
  using (
    public.has_role(auth.uid(), 'manager')
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'extreme_admin')
  );

-- manager insert support
create policy "Tournament logs writable by managers and admins"
  on public.tournament_logs
  for insert
  with check (
    public.has_role(auth.uid(), 'manager')
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'extreme_admin')
  );

create or replace function public.log_tournament_action(
  p_tournament_id uuid,
  p_action text,
  p_performed_by uuid,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tournament_logs(tournament_id, action, performed_by, details)
  values (p_tournament_id, p_action, p_performed_by, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Canonical matches compatibility view requested by product prompt
create or replace view public.matches as
select
  tm.id,
  tm.tournament_id,
  coalesce(tm.round_number, tm.round) as round_number,
  tm.player1_id,
  tm.player2_id,
  tm.score_player1 as player1_score,
  tm.score_player2 as player2_score,
  tm.winner_id,
  case
    when tm.status in ('pending', 'ready') then 'waiting'
    when tm.status = 'live' then 'playing'
    else tm.status
  end as status,
  tm.starts_at as started_at,
  tm.finished_at as ended_at,
  tm.created_at
from public.tournament_matches tm;

-- manager can add users by username
create or replace function public.manager_add_tournament_player(
  p_tournament_id uuid,
  p_username text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_player_id uuid;
  v_tournament public.tournaments%rowtype;
  v_started boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.has_role(v_uid, 'manager')
    or public.has_role(v_uid, 'admin')
    or public.has_role(v_uid, 'extreme_admin')
  ) then
    raise exception 'Only managers/admins can add tournament players';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'Tournament not found';
  end if;

  select p.id into v_player_id
  from public.profiles p
  where lower(coalesce(p.username, p.name, '')) = lower(trim(p_username))
  limit 1;

  if v_player_id is null then
    raise exception 'User not found for username/name: %', p_username;
  end if;

  if exists (
    select 1
    from public.tournament_players tp
    where tp.tournament_id = p_tournament_id and tp.user_id = v_player_id
  ) then
    raise exception 'Player already registered';
  end if;

  insert into public.tournament_players(tournament_id, user_id, status, join_status)
  values (p_tournament_id, v_player_id, 'active', 'active');

  perform public.recount_tournament_players(p_tournament_id);
  v_started := public.start_tournament_if_full(p_tournament_id);

  perform public.emit_tournament_event(
    p_tournament_id,
    'join',
    jsonb_build_object('added_by_manager', true, 'user_id', v_player_id, 'username', p_username)
  );

  perform public.log_tournament_action(
    p_tournament_id,
    'manager_add_player',
    v_uid,
    jsonb_build_object('user_id', v_player_id, 'username', p_username, 'auto_started', v_started)
  );

  return jsonb_build_object('ok', true, 'user_id', v_player_id, 'auto_started', v_started);
end;
$$;

create or replace function public.manager_remove_tournament_player(
  p_tournament_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.has_role(v_uid, 'manager')
    or public.has_role(v_uid, 'admin')
    or public.has_role(v_uid, 'extreme_admin')
  ) then
    raise exception 'Only managers/admins can remove tournament players';
  end if;

  delete from public.tournament_players
  where tournament_id = p_tournament_id
    and user_id = p_user_id;

  perform public.recount_tournament_players(p_tournament_id);

  perform public.emit_tournament_event(
    p_tournament_id,
    'player_removed',
    jsonb_build_object('removed_by_manager', true, 'user_id', p_user_id)
  );

  perform public.log_tournament_action(
    p_tournament_id,
    'manager_remove_player',
    v_uid,
    jsonb_build_object('user_id', p_user_id)
  );

  return jsonb_build_object('ok', true);
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

  update public.tournament_matches
  set status = case when v_status = 'playing' then 'playing' when v_status = 'waiting' then 'waiting' else 'finished' end,
      starts_at = case when v_status = 'playing' then coalesce(starts_at, now()) else starts_at end,
      finished_at = case when v_status = 'finished' then coalesce(finished_at, now()) else finished_at end,
      updated_at = now()
  where id = p_match_id;

  perform public.emit_tournament_event(
    v_match.tournament_id,
    case when v_status = 'playing' then 'match_start' when v_status = 'finished' then 'match_end' else 'match_waiting' end,
    jsonb_build_object('match_id', p_match_id, 'status', v_status)
  );

  perform public.log_tournament_action(
    v_match.tournament_id,
    'manager_match_status',
    v_uid,
    jsonb_build_object('match_id', p_match_id, 'status', v_status)
  );

  return jsonb_build_object('ok', true, 'match_id', p_match_id, 'status', v_status);
end;
$$;

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

  perform public.emit_tournament_event(
    p_tournament_id,
    case when v_status = 'active' then 'resume' when v_status = 'waiting' then 'pause' else 'status_update' end,
    jsonb_build_object('status', v_status)
  );

  perform public.log_tournament_action(
    p_tournament_id,
    'manager_tournament_status',
    v_uid,
    jsonb_build_object('status', v_status)
  );

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

create or replace function public.manager_skip_to_next_round(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_round integer;
  v_created integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.has_role(v_uid, 'manager')
    or public.has_role(v_uid, 'admin')
    or public.has_role(v_uid, 'extreme_admin')
  ) then
    raise exception 'Only managers/admins can skip rounds';
  end if;

  select max(round) into v_round
  from public.tournament_matches
  where tournament_id = p_tournament_id;

  if v_round is null then
    raise exception 'No matches available for this tournament';
  end if;

  v_created := public.create_next_round_matches(p_tournament_id, v_round);

  perform public.emit_tournament_event(
    p_tournament_id,
    'round_start',
    jsonb_build_object('source', 'manager_skip', 'next_round', v_round + 1, 'created_matches', v_created)
  );

  perform public.log_tournament_action(
    p_tournament_id,
    'manager_skip_round',
    v_uid,
    jsonb_build_object('current_round', v_round, 'created_matches', v_created)
  );

  return jsonb_build_object('ok', true, 'round', v_round + 1, 'matches_created', v_created);
end;
$$;

-- Keep create_tournament using canonical question_count
create or replace function public.create_tournament(
  p_name text,
  p_max_players integer,
  p_subject text,
  p_questions_count integer,
  p_mode text,
  p_entry_fee integer default 0
)
returns public.tournaments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament public.tournaments%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not (public.has_role(v_uid, 'manager') or public.has_role(v_uid, 'admin') or public.has_role(v_uid, 'extreme_admin')) then
    raise exception 'Only managers or admins can create tournaments';
  end if;

  if p_max_players not in (8, 16, 32) then
    raise exception 'Player count must be 8, 16, or 32';
  end if;

  insert into public.tournaments (
    name,
    title,
    max_participants,
    max_players,
    current_players,
    status,
    subject,
    questions_count,
    question_count,
    mode,
    entry_fee,
    entry_fee_coins,
    entry_cost,
    settings,
    created_by,
    starts_at,
    start_time,
    end_time,
    ends_at,
    prize_coins
  )
  values (
    p_name,
    p_name,
    p_max_players,
    p_max_players,
    0,
    'waiting',
    p_subject,
    p_questions_count,
    p_questions_count,
    p_mode,
    greatest(p_entry_fee, 0),
    greatest(p_entry_fee, 0),
    greatest(p_entry_fee, 0),
    jsonb_build_object('subject', p_subject, 'question_count', p_questions_count, 'mode', p_mode, 'max_players', p_max_players, 'entry_fee', greatest(p_entry_fee, 0)),
    v_uid,
    now(),
    now(),
    now() + interval '2 hours',
    now() + interval '2 hours',
    1500
  )
  returning * into v_tournament;

  perform public.emit_tournament_event(v_tournament.id, 'tournament_created', jsonb_build_object('name', p_name));
  perform public.log_tournament_action(v_tournament.id, 'tournament_created', v_uid, jsonb_build_object('name', p_name));

  return v_tournament;
end;
$$;

-- grant RPCs
revoke all on function public.manager_add_tournament_player(uuid, text) from public;
revoke all on function public.manager_remove_tournament_player(uuid, uuid) from public;
revoke all on function public.manager_update_match_status(uuid, text) from public;
revoke all on function public.manager_set_tournament_status(uuid, text) from public;
revoke all on function public.manager_skip_to_next_round(uuid) from public;

grant execute on function public.manager_add_tournament_player(uuid, text) to authenticated;
grant execute on function public.manager_remove_tournament_player(uuid, uuid) to authenticated;
grant execute on function public.manager_update_match_status(uuid, text) to authenticated;
grant execute on function public.manager_set_tournament_status(uuid, text) to authenticated;
grant execute on function public.manager_skip_to_next_round(uuid) to authenticated;
