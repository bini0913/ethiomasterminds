-- Complete tournament automation flow: manager setup, join, auto-start, bracket progression, rewards, and manager overrides

-- 1) Bring transactions type constraint up to date for tournament economy events
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type in (
    'earn', 'spend', 'transfer', 'bonus', 'convert', 'purchase', 'gift',
    'tournament_entry', 'tournament_reward'
  ));

-- 2) Tournament schema alignment (compatible with both legacy and current UI)
alter table public.tournaments add column if not exists current_players integer not null default 0;
alter table public.tournaments add column if not exists winner_id uuid references public.profiles(id) on delete set null;
alter table public.tournaments add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.tournaments add column if not exists questions_count integer;
alter table public.tournaments add column if not exists mode text;
alter table public.tournaments add column if not exists entry_fee integer;
alter table public.tournaments add column if not exists winner_badge text;

-- keep historic states + new canonical states
alter table public.tournaments drop constraint if exists tournaments_status_check;
alter table public.tournaments
  add constraint tournaments_status_check
  check (status in (
    'waiting', 'starting', 'active', 'finished', 'cancelled',
    'upcoming', 'completed', 'next_round'
  ));

-- tournament_players state alignment
alter table public.tournament_players add column if not exists status text;
alter table public.tournament_players add column if not exists joined_at timestamptz not null default now();
update public.tournament_players
set status = case
  when join_status in ('eliminated') then 'eliminated'
  when join_status in ('champion') then 'champion'
  when join_status in ('runner_up') then 'runner_up'
  else 'active'
end
where status is null;

alter table public.tournament_players alter column status set not null;
alter table public.tournament_players drop constraint if exists tournament_players_status_check;
alter table public.tournament_players
  add constraint tournament_players_status_check
  check (status in ('active', 'eliminated', 'champion', 'runner_up', 'withdrawn'));

-- match state alignment, while keeping backwards compatibility
alter table public.tournament_matches add column if not exists score_player1 integer;
alter table public.tournament_matches add column if not exists score_player2 integer;
alter table public.tournament_matches add column if not exists room_id text;
alter table public.tournament_matches add column if not exists meta jsonb not null default '{}'::jsonb;

alter table public.tournament_matches drop constraint if exists tournament_matches_status_check;
alter table public.tournament_matches
  add constraint tournament_matches_status_check
  check (status in ('waiting', 'playing', 'finished', 'pending', 'ready', 'live'));

-- canonical alias table name requested by product spec
create or replace view public.matches as
select
  id,
  tournament_id,
  player1_id,
  player2_id,
  round,
  case
    when status in ('pending', 'ready') then 'waiting'
    when status = 'live' then 'playing'
    else status
  end as status,
  winner_id,
  score_player1,
  score_player2,
  created_at,
  updated_at
from public.tournament_matches;

-- real-time stream for UI updates
create table if not exists public.tournament_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tournament_events_tournament_created
  on public.tournament_events(tournament_id, created_at desc);

alter table public.tournament_events enable row level security;

drop policy if exists "Tournament events are readable by authenticated users" on public.tournament_events;
create policy "Tournament events are readable by authenticated users"
  on public.tournament_events
  for select
  using (auth.uid() is not null);

create policy "Managers and admins can write tournament events"
  on public.tournament_events
  for insert
  with check (public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'admin'));

-- utilities
create or replace function public.emit_tournament_event(
  p_tournament_id uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tournament_events(tournament_id, event_type, payload)
  values (p_tournament_id, p_event_type, coalesce(p_payload, '{}'::jsonb));
end;
$$;

create or replace function public.sync_tournament_settings()
returns trigger
language plpgsql
as $$
begin
  new.settings := coalesce(new.settings, '{}'::jsonb)
    || jsonb_build_object(
      'subject', coalesce(new.subject, 'General'),
      'questions', coalesce(new.questions_count, 10),
      'mode', coalesce(new.mode, 'classic'),
      'entry_fee', coalesce(new.entry_fee, coalesce(new.entry_fee_coins, 0))
    );

  if new.max_participants is not null and (new.settings ->> 'max_players') is null then
    new.settings := new.settings || jsonb_build_object('max_players', new.max_participants);
  end if;

  new.entry_fee := coalesce(new.entry_fee, new.entry_fee_coins, 0);
  return new;
end;
$$;

drop trigger if exists trg_sync_tournament_settings on public.tournaments;
create trigger trg_sync_tournament_settings
before insert or update on public.tournaments
for each row
execute function public.sync_tournament_settings();

-- keep current_players accurate
create or replace function public.recount_tournament_players(p_tournament_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*)::integer into v_count
  from public.tournament_players
  where tournament_id = p_tournament_id
    and status in ('active', 'champion', 'runner_up');

  update public.tournaments
  set current_players = v_count
  where id = p_tournament_id;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.handle_tournament_player_counter()
returns trigger
language plpgsql
as $$
declare
  v_tid uuid;
begin
  v_tid := coalesce(new.tournament_id, old.tournament_id);
  perform public.recount_tournament_players(v_tid);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_tournament_player_counter on public.tournament_players;
create trigger trg_tournament_player_counter
after insert or update or delete on public.tournament_players
for each row
execute function public.handle_tournament_player_counter();

-- auto bracket generation
create or replace function public.start_tournament_if_full(p_tournament_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_players uuid[];
  v_player_count integer;
  v_max integer;
  i integer;
  j integer;
  tmp uuid;
begin
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'Tournament not found';
  end if;

  v_max := coalesce(v_tournament.max_participants, (v_tournament.settings ->> 'max_players')::integer, 0);
  if v_max not in (8, 16, 32) then
    raise exception 'Tournament max players must be 8, 16, or 32';
  end if;

  select array_agg(tp.user_id order by random()) into v_players
  from public.tournament_players tp
  where tp.tournament_id = p_tournament_id
    and tp.status = 'active';

  v_player_count := coalesce(array_length(v_players, 1), 0);

  if v_player_count < v_max then
    return false;
  end if;

  delete from public.tournament_matches where tournament_id = p_tournament_id;

  update public.tournaments
  set status = 'starting'
  where id = p_tournament_id;

  -- Fisher-Yates shuffle (extra randomization even after order by random())
  for i in reverse v_player_count..2 loop
    j := 1 + floor(random() * i)::int;
    tmp := v_players[i];
    v_players[i] := v_players[j];
    v_players[j] := tmp;
  end loop;

  for i in 1..(v_max / 2) loop
    insert into public.tournament_matches (
      tournament_id,
      round,
      bracket_position,
      status,
      player1_id,
      player2_id
    )
    values (
      p_tournament_id,
      1,
      i,
      'waiting',
      v_players[(i * 2) - 1],
      v_players[i * 2]
    );
  end loop;

  update public.tournaments
  set status = 'active'
  where id = p_tournament_id;

  perform public.emit_tournament_event(
    p_tournament_id,
    'tournament_started',
    jsonb_build_object('round', 1, 'match_count', v_max / 2)
  );

  return true;
end;
$$;

create or replace function public.create_next_round_matches(p_tournament_id uuid, p_round integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winners uuid[];
  v_count integer;
  i integer;
begin
  select array_agg(winner_id order by bracket_position) into v_winners
  from public.tournament_matches
  where tournament_id = p_tournament_id
    and round = p_round
    and winner_id is not null
    and status = 'finished';

  v_count := coalesce(array_length(v_winners, 1), 0);

  if v_count <= 1 then
    return 0;
  end if;

  for i in 1..(v_count / 2) loop
    insert into public.tournament_matches (
      tournament_id,
      round,
      bracket_position,
      status,
      player1_id,
      player2_id
    )
    values (
      p_tournament_id,
      p_round + 1,
      i,
      'waiting',
      v_winners[(i * 2) - 1],
      v_winners[i * 2]
    )
    on conflict (tournament_id, round, bracket_position) do nothing;
  end loop;

  perform public.emit_tournament_event(
    p_tournament_id,
    'next_round_created',
    jsonb_build_object('round', p_round + 1, 'players', v_count)
  );

  return v_count / 2;
end;
$$;

create or replace function public.finalize_tournament(p_tournament_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_final public.tournament_matches%rowtype;
  v_runner_up uuid;
  v_winner_reward integer;
  v_runner_reward integer;
  v_winner_xp integer;
  v_runner_xp integer;
begin
  select tm.* into v_final
  from public.tournament_matches tm
  where tm.tournament_id = p_tournament_id
    and tm.status = 'finished'
  order by tm.round desc, tm.bracket_position asc
  limit 1;

  if not found or v_final.winner_id is null then
    raise exception 'No final winner found';
  end if;

  v_runner_up := case
    when v_final.player1_id = v_final.winner_id then v_final.player2_id
    else v_final.player1_id
  end;

  select
    coalesce(reward_winner_coins, prize_coins, 1500),
    coalesce(reward_runner_up_coins, greatest(coalesce(prize_coins, 1500) / 2, 100)),
    coalesce(reward_winner_xp, 800),
    coalesce(reward_runner_up_xp, 300)
  into v_winner_reward, v_runner_reward, v_winner_xp, v_runner_xp
  from public.tournaments
  where id = p_tournament_id;

  update public.tournament_players
  set status = case
    when user_id = v_final.winner_id then 'champion'
    when user_id = v_runner_up then 'runner_up'
    else status
  end
  where tournament_id = p_tournament_id
    and user_id in (v_final.winner_id, v_runner_up);

  perform public.ensure_wallet(v_final.winner_id);
  update public.wallets set coins = coins + v_winner_reward where user_id = v_final.winner_id;

  insert into public.transactions(sender_id, receiver_id, amount, type, source)
  values (null, v_final.winner_id, v_winner_reward, 'tournament_reward', 'tournament_winner');

  update public.profiles
  set xp = coalesce(xp, 0) + v_winner_xp
  where id = v_final.winner_id;

  if v_runner_up is not null then
    perform public.ensure_wallet(v_runner_up);
    update public.wallets set coins = coins + v_runner_reward where user_id = v_runner_up;

    insert into public.transactions(sender_id, receiver_id, amount, type, source)
    values (null, v_runner_up, v_runner_reward, 'tournament_reward', 'tournament_runner_up');

    update public.profiles
    set xp = coalesce(xp, 0) + v_runner_xp
    where id = v_runner_up;
  end if;

  update public.tournaments
  set winner_id = v_final.winner_id,
      champion_user_id = v_final.winner_id,
      runner_up_user_id = v_runner_up,
      winner_badge = 'Tournament Champion',
      status = 'finished',
      ends_at = now(),
      end_time = now()
  where id = p_tournament_id;

  perform public.emit_tournament_event(
    p_tournament_id,
    'tournament_finished',
    jsonb_build_object(
      'winner_id', v_final.winner_id,
      'runner_up_id', v_runner_up,
      'winner_reward_coins', v_winner_reward,
      'runner_up_reward_coins', coalesce(v_runner_reward, 0)
    )
  );

  return v_final.winner_id;
end;
$$;

create or replace function public.complete_match_and_progress(
  p_match_id uuid,
  p_winner_id uuid,
  p_player1_score integer default null,
  p_player2_score integer default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.tournament_matches%rowtype;
  v_round_open integer;
  v_next_count integer;
  v_winner uuid;
  v_loser uuid;
begin
  select * into v_match
  from public.tournament_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if not p_force and v_match.status = 'finished' then
    return jsonb_build_object('ok', true, 'message', 'Match already finished');
  end if;

  if p_winner_id is null or p_winner_id not in (v_match.player1_id, v_match.player2_id) then
    raise exception 'Winner must be one of the match players';
  end if;

  v_winner := p_winner_id;
  v_loser := case when v_match.player1_id = v_winner then v_match.player2_id else v_match.player1_id end;

  update public.tournament_matches
  set winner_id = v_winner,
      status = 'finished',
      score_player1 = coalesce(p_player1_score, score_player1),
      score_player2 = coalesce(p_player2_score, score_player2),
      finished_at = now(),
      updated_at = now()
  where id = p_match_id;

  if v_loser is not null then
    update public.tournament_players
    set status = 'eliminated',
        join_status = 'eliminated',
        eliminated_round = v_match.round,
        updated_at = now()
    where tournament_id = v_match.tournament_id
      and user_id = v_loser;
  end if;

  perform public.emit_tournament_event(
    v_match.tournament_id,
    'match_finished',
    jsonb_build_object(
      'match_id', p_match_id,
      'round', v_match.round,
      'winner_id', v_winner,
      'loser_id', v_loser,
      'score_player1', p_player1_score,
      'score_player2', p_player2_score
    )
  );

  select count(*)::integer into v_round_open
  from public.tournament_matches
  where tournament_id = v_match.tournament_id
    and round = v_match.round
    and status <> 'finished';

  if v_round_open = 0 then
    update public.tournaments
    set status = 'next_round'
    where id = v_match.tournament_id;

    v_next_count := public.create_next_round_matches(v_match.tournament_id, v_match.round);

    if v_next_count = 0 then
      v_winner := public.finalize_tournament(v_match.tournament_id);
      return jsonb_build_object('ok', true, 'finished', true, 'winner_id', v_winner);
    end if;

    update public.tournaments
    set status = 'active'
    where id = v_match.tournament_id;

    return jsonb_build_object('ok', true, 'finished', false, 'next_round', v_match.round + 1, 'matches_created', v_next_count);
  end if;

  return jsonb_build_object('ok', true, 'finished', false, 'next_round', null);
end;
$$;

-- 3) Main product RPCs
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

  if not (public.has_role(v_uid, 'manager') or public.has_role(v_uid, 'admin')) then
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
    p_mode,
    greatest(p_entry_fee, 0),
    greatest(p_entry_fee, 0),
    greatest(p_entry_fee, 0),
    jsonb_build_object('subject', p_subject, 'questions', p_questions_count, 'mode', p_mode, 'max_players', p_max_players, 'entry_fee', greatest(p_entry_fee, 0)),
    v_uid,
    now(),
    now(),
    now() + interval '2 hours',
    now() + interval '2 hours',
    1500
  )
  returning * into v_tournament;

  perform public.emit_tournament_event(v_tournament.id, 'tournament_created', jsonb_build_object('name', p_name));

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

  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'Tournament not found';
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

  v_started := public.start_tournament_if_full(p_tournament_id);

  return jsonb_build_object(
    'ok', true,
    'auto_started', v_started,
    'tournament_id', p_tournament_id
  );
end;
$$;

create or replace function public.force_start_tournament(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_started boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not (public.has_role(v_uid, 'manager') or public.has_role(v_uid, 'admin')) then
    raise exception 'Only managers/admins can force start tournaments';
  end if;

  v_started := public.start_tournament_if_full(p_tournament_id);

  if not v_started then
    raise exception 'Cannot start yet: tournament not full. Use manual match editing if needed';
  end if;

  perform public.emit_tournament_event(p_tournament_id, 'tournament_force_started', jsonb_build_object('by', v_uid));
  return jsonb_build_object('ok', true, 'started', true);
end;
$$;

create or replace function public.manager_set_match_winner(
  p_match_id uuid,
  p_winner_id uuid,
  p_player1_score integer default null,
  p_player2_score integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.tournament_matches%rowtype;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not (public.has_role(v_uid, 'manager') or public.has_role(v_uid, 'admin')) then
    raise exception 'Only managers/admins can set winner manually';
  end if;

  select * into v_match from public.tournament_matches where id = p_match_id;
  if not found then
    raise exception 'Match not found';
  end if;

  v_result := public.complete_match_and_progress(p_match_id, p_winner_id, p_player1_score, p_player2_score, true);

  perform public.emit_tournament_event(
    v_match.tournament_id,
    'manager_override_winner',
    jsonb_build_object('match_id', p_match_id, 'winner_id', p_winner_id, 'by', v_uid)
  );

  return v_result;
end;
$$;

create or replace function public.cancel_tournament(p_tournament_id uuid)
returns jsonb
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

  if not (public.has_role(v_uid, 'manager') or public.has_role(v_uid, 'admin')) then
    raise exception 'Only managers/admins can cancel tournaments';
  end if;

  select * into v_tournament from public.tournaments where id = p_tournament_id;
  if not found then
    raise exception 'Tournament not found';
  end if;

  update public.tournaments
  set status = 'cancelled',
      ends_at = now(),
      end_time = now()
  where id = p_tournament_id;

  update public.tournament_players
  set status = 'withdrawn',
      join_status = 'eliminated'
  where tournament_id = p_tournament_id
    and status = 'active';

  perform public.emit_tournament_event(p_tournament_id, 'tournament_cancelled', jsonb_build_object('by', v_uid));

  return jsonb_build_object('ok', true, 'cancelled', true);
end;
$$;

-- permissions for RPC usage
revoke all on function public.create_tournament(text, integer, text, integer, text, integer) from public;
revoke all on function public.join_tournament(uuid) from public;
revoke all on function public.force_start_tournament(uuid) from public;
revoke all on function public.manager_set_match_winner(uuid, uuid, integer, integer) from public;
revoke all on function public.cancel_tournament(uuid) from public;
revoke all on function public.complete_match_and_progress(uuid, uuid, integer, integer, boolean) from public;

grant execute on function public.create_tournament(text, integer, text, integer, text, integer) to authenticated;
grant execute on function public.join_tournament(uuid) to authenticated;
grant execute on function public.complete_match_and_progress(uuid, uuid, integer, integer, boolean) to authenticated;
grant execute on function public.force_start_tournament(uuid) to authenticated;
grant execute on function public.manager_set_match_winner(uuid, uuid, integer, integer) to authenticated;
grant execute on function public.cancel_tournament(uuid) to authenticated;
