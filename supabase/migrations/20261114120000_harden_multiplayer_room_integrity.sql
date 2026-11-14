-- Multiplayer integrity hardening.
-- Room secrets are moved out of the exposed room row; clients never receive password hashes.
-- Direct client writes are removed: state transitions remain behind validated RPCs.

create table public.multiplayer_room_secrets (
  room_id uuid primary key references public.multiplayer_rooms(id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Preserve existing private-room passwords while moving them to a non-client-readable table.
insert into public.multiplayer_room_secrets (room_id, password_hash)
select id, extensions.crypt(encode(extensions.digest(password, 'sha256'), 'hex'), extensions.gen_salt('bf'))
from public.multiplayer_rooms
where password is not null and length(password) > 0
on conflict (room_id) do nothing;

alter table public.multiplayer_rooms add column has_password boolean not null default false;
update public.multiplayer_rooms mr
set has_password = exists (
  select 1 from public.multiplayer_room_secrets s where s.room_id = mr.id
);

alter table public.multiplayer_room_secrets enable row level security;

create or replace function public.is_multiplayer_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.room_players rp
      where rp.room_id = p_room_id and rp.user_id = (select auth.uid())
    );
$$;

create or replace function public.is_multiplayer_public_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.multiplayer_rooms mr
    where mr.id = p_room_id
      and mr.status in ('waiting', 'countdown')
      and mr.has_password = false
  );
$$;

revoke all on function public.is_multiplayer_room_member(uuid) from public, anon;
revoke all on function public.is_multiplayer_public_room(uuid) from public, anon;
grant execute on function public.is_multiplayer_room_member(uuid) to authenticated;
grant execute on function public.is_multiplayer_public_room(uuid) to authenticated;

-- Drop every legacy policy on these tables. Permissive policies are OR-combined,
-- so leaving even one USING (true) policy would defeat the membership policies.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'multiplayer_rooms',
        'room_players',
        'room_answers',
        'room_questions',
        'room_state',
        'room_chat_messages'
      )
  loop
    execute format('drop policy %I on public.%I', v_policy.policyname, v_policy.tablename);
  end loop;
end;
$$;

alter table public.multiplayer_rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_answers enable row level security;
alter table public.room_questions enable row level security;
alter table public.room_state enable row level security;
alter table public.room_chat_messages enable row level security;

create policy multiplayer_rooms_member_or_public_read
on public.multiplayer_rooms
for select to authenticated
using (
  public.is_multiplayer_room_member(id)
  or public.is_multiplayer_public_room(id)
);

-- Room rosters are visible to members and while an unlocked room is discoverable.
create policy room_players_member_or_public_lobby_read
on public.room_players
for select to authenticated
using (
  public.is_multiplayer_room_member(room_id)
  or public.is_multiplayer_public_room(room_id)
);

create policy room_state_member_read
on public.room_state
for select to authenticated
using (public.is_multiplayer_room_member(room_id));

create policy room_chat_member_read
on public.room_chat_messages
for select to authenticated
using (public.is_multiplayer_room_member(room_id));

-- No client-facing policies for answers, question assignments, or room secrets.
-- Those records are accessed only inside validated SECURITY DEFINER routines.

revoke all privileges on table
  public.multiplayer_rooms,
  public.room_players,
  public.room_answers,
  public.room_questions,
  public.room_state,
  public.room_chat_messages,
  public.multiplayer_room_secrets
from anon, authenticated;

-- Remove historical column-level grants as well as table-level grants.
do $$
declare
  v_table record;
begin
  for v_table in
    select table_name,
           string_agg(quote_ident(column_name), ', ' order by ordinal_position) as columns
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'multiplayer_rooms',
        'room_players',
        'room_answers',
        'room_questions',
        'room_state',
        'room_chat_messages',
        'multiplayer_room_secrets'
      )
    group by table_name
  loop
    execute format(
      'revoke all privileges (%s) on table public.%I from anon, authenticated',
      v_table.columns,
      v_table.table_name
    );
  end loop;
end;
$$;

-- All room columns are now safe to read; table-level SELECT also preserves
-- Supabase Realtime authorization. Password hashes live in the private table.
grant select on table public.multiplayer_rooms to authenticated;
grant select on table public.room_players to authenticated;
grant select on table public.room_state to authenticated;
grant select on table public.room_chat_messages to authenticated;

-- Replace room creation/joining so password checks happen only in the database.
create or replace function public.multiplayer_create_room(
  p_name text,
  p_subject text,
  p_difficulty text,
  p_question_count integer,
  p_max_players integer,
  p_password text default null
)
returns public.multiplayer_rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_room public.multiplayer_rooms%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_max_players is null or p_max_players < 2 or p_max_players > 8 then
    raise exception 'Player limit must be between 2 and 8';
  end if;
  if p_question_count is null or p_question_count < 1 or p_question_count > 50 then
    raise exception 'Question count must be between 1 and 50';
  end if;
  if octet_length(coalesce(p_password, '')) > 256 then
    raise exception 'Room password is too long';
  end if;

  insert into public.multiplayer_rooms (
    name, host_id, max_players, subject, difficulty,
    question_count, has_password, status, game_mode
  )
  values (
    left(trim(coalesce(p_name, 'Room')), 80),
    v_uid,
    p_max_players,
    coalesce(nullif(trim(p_subject), ''), 'Mixed'),
    coalesce(nullif(trim(p_difficulty), ''), 'Medium'),
    p_question_count,
    nullif(trim(coalesce(p_password, '')), '') is not null,
    'waiting',
    'speed'
  )
  returning * into v_room;

  if nullif(trim(coalesce(p_password, '')), '') is not null then
    insert into public.multiplayer_room_secrets (room_id, password_hash)
    values (v_room.id, extensions.crypt(encode(extensions.digest(p_password, 'sha256'), 'hex'), extensions.gen_salt('bf')));
  end if;

  insert into public.room_players (room_id, user_id, is_ready)
  values (v_room.id, v_uid, true);

  return v_room;
end;
$$;

create or replace function public.multiplayer_join_room(
  p_room_id uuid,
  p_password text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
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

  -- Existing players may reconnect to a live match without rejoining.
  if exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = v_uid
  ) then
    return true;
  end if;

  -- New players cannot enter after the match starts.
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

-- Remove the former exposed plaintext password column only after the room RPCs
-- no longer reference it.
alter table public.multiplayer_rooms drop column password;

-- A client may only assert existing membership; it cannot silently join a
-- password-protected room through the old ensure-membership RPC.
create or replace function public.multiplayer_assert_room_member(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_multiplayer_room_member(p_room_id) then
    raise exception 'You are not a member of this room';
  end if;
  return true;
end;
$$;

revoke all on function public.multiplayer_assert_room_member(uuid) from public, anon;
grant execute on function public.multiplayer_assert_room_member(uuid) to authenticated;
revoke all on function public.multiplayer_ensure_membership(uuid) from public, anon, authenticated;

-- Host-authorized countdown state transition; no direct room_state upsert is needed.
create or replace function public.multiplayer_set_countdown(p_room_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host uuid;
  v_status text;
  v_end timestamptz := clock_timestamp() + interval '5 seconds';
  v_player_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select host_id, status
    into v_host, v_status
  from public.multiplayer_rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Room not found';
  end if;
  if v_host <> (select auth.uid()) then
    raise exception 'Only the host can start the countdown';
  end if;
  if v_status not in ('waiting', 'countdown') then
    raise exception 'Room is not waiting to start';
  end if;

  select count(*)::integer into v_player_count
  from public.room_players
  where room_id = p_room_id;

  if v_player_count < 2 then
    raise exception 'At least 2 players are required';
  end if;
  if exists (
    select 1 from public.room_players
    where room_id = p_room_id
      and user_id <> v_host
      and coalesce(is_ready, false) = false
  ) then
    raise exception 'All other players must be ready';
  end if;

  insert into public.room_state (
    room_id, status, question_started_at, question_ends_at, updated_at
  )
  values (p_room_id, 'starting', clock_timestamp(), v_end, clock_timestamp())
  on conflict (room_id) do update
    set status = 'starting',
        question_started_at = excluded.question_started_at,
        question_ends_at = excluded.question_ends_at,
        updated_at = excluded.updated_at;

  update public.multiplayer_rooms
  set status = 'countdown'
  where id = p_room_id;

  return v_end;
end;
$$;

revoke all on function public.multiplayer_set_countdown(uuid) from public, anon;
grant execute on function public.multiplayer_set_countdown(uuid) to authenticated;

-- Harden answer submission: authentication, membership, assigned-question and
-- option validation, server-measured elapsed time, and server-owned scoring.
create or replace function public.multiplayer_submit_answer(
  p_room_id uuid,
  p_question_id uuid,
  p_answer text,
  p_time_used integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.multiplayer_rooms%rowtype;
  p public.room_players%rowtype;
  q public.questions%rowtype;
  rq public.room_questions%rowtype;
  ok boolean;
  pts integer;
  correct_index integer;
  elapsed integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select * into r
  from public.multiplayer_rooms
  where id = p_room_id;

  if not found or r.status <> 'playing' then
    raise exception 'Match is not playing';
  end if;

  select * into p
  from public.room_players
  where room_id = p_room_id and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Not a room player';
  end if;

  if r.game_mode = 'speed'
     and r.started_at is not null
     and clock_timestamp() >= r.started_at + interval '1 minute' then
    update public.multiplayer_rooms
    set status = 'finished', finished_at = clock_timestamp()
    where id = p_room_id and status = 'playing';
    update public.room_state
    set status = 'finished', updated_at = clock_timestamp()
    where room_id = p_room_id;
    return jsonb_build_object('finished', true);
  end if;

  select * into rq
  from public.room_questions
  where room_id = p_room_id
    and question_id = p_question_id
    and order_index = p.current_question_index;

  if not found then
    raise exception 'That is not your current question';
  end if;

  if exists (
    select 1 from public.room_answers
    where room_id = p_room_id
      and user_id = (select auth.uid())
      and question_id = p_question_id
  ) then
    raise exception 'Question already answered';
  end if;

  select * into q
  from public.questions
  where id = p_question_id;

  if not found then
    raise exception 'Question not found';
  end if;

  if p_answer is null
     or length(p_answer) > 500
     or not exists (
       select 1
       from jsonb_array_elements_text(coalesce(q.options, '[]'::jsonb)) as option_value(value)
       where lower(trim(option_value.value)) = lower(trim(p_answer))
     ) then
    raise exception 'Answer must match one of the available options';
  end if;

  elapsed := greatest(
    0,
    extract(epoch from (clock_timestamp() - coalesce(p.question_started_at, clock_timestamp())))::integer
  );

  ok := lower(trim(p_answer)) = lower(trim(coalesce(q.correct_answer, '')))
        and (r.game_mode = 'speed' or elapsed <= 30);
  pts := case when ok then greatest(1, coalesce(q.points, 100)) else 0 end;

  select (elem.ordinality - 1)::integer
    into correct_index
  from jsonb_array_elements_text(coalesce(q.options, '[]'::jsonb)) with ordinality elem
  where lower(trim(elem.value)) = lower(trim(coalesce(q.correct_answer, '')))
  limit 1;

  insert into public.room_answers (
    room_id, user_id, question_id, answer, is_correct, points, time_used
  )
  values (
    p_room_id, (select auth.uid()), p_question_id, trim(p_answer), ok, pts, elapsed
  );

  update public.room_players
  set score = coalesce(score, 0) + pts,
      answered_count = answered_count + 1,
      correct_count = correct_count + case when ok then 1 else 0 end,
      current_question_index = case
        when r.game_mode = 'speed' then current_question_index + 1
        else current_question_index
      end,
      question_started_at = case
        when r.game_mode = 'speed' then clock_timestamp()
        else question_started_at
      end
  where id = p.id;

  return jsonb_build_object(
    'is_correct', ok,
    'points', pts,
    'correct_answer', q.correct_answer,
    'correct_index', correct_index,
    'game_mode', r.game_mode,
    'answered_count', p.answered_count + 1,
    'correct_count', p.correct_count + case when ok then 1 else 0 end,
    'score', coalesce(p.score, 0) + pts,
    'time_used', elapsed,
    'timed_out', r.game_mode = 'accuracy' and elapsed > 30
  );
end;
$$;

-- RPCs are the only write path. Remove implicit PUBLIC/anon EXECUTE grants
-- from multiplayer SECURITY DEFINER routines and grant only authenticated callers.
do $$
declare
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as signature,
           p.proname,
           p.prorettype
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname like 'multiplayer\_%' escape '\'
  loop
    execute format('revoke execute on function %s from public, anon', v_fn.signature);
    execute format('alter function %s set search_path = %L', v_fn.signature, '');

    if v_fn.proname = 'multiplayer_record_ranked_result'
       or v_fn.prorettype = 'trigger'::regtype then
      execute format('revoke execute on function %s from authenticated', v_fn.signature);
    elsif v_fn.proname <> 'multiplayer_ensure_membership' then
      execute format('grant execute on function %s to authenticated', v_fn.signature);
    end if;
  end loop;
end;
$$;

-- Cleanup is a bounded maintenance RPC; it is never exposed to anonymous callers.
revoke execute on function public.cleanup_expired_multiplayer_rooms() from public, anon;
alter function public.cleanup_expired_multiplayer_rooms() set search_path = '';
grant execute on function public.cleanup_expired_multiplayer_rooms() to authenticated;

comment on table public.room_answers is
  'Private gameplay records. Client access is denied; use validated multiplayer RPCs.';
comment on table public.room_questions is
  'Private per-room question assignment. Client access is denied; use validated multiplayer RPCs.';
comment on table public.multiplayer_room_secrets is
  'Private room password hashes. No direct client privileges; access only through validated room RPCs.';
