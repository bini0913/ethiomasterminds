begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

-- Isolated fixtures; the test transaction rolls back all inserted rows.
insert into public.multiplayer_rooms (id, name, host_id, max_players, status, has_password)
values
  ('a1000000-0000-4000-8000-000000000001', 'RLS public room', 'a2000000-0000-4000-8000-000000000001', 4, 'waiting', false),
  ('a1000000-0000-4000-8000-000000000002', 'RLS private room', 'a2000000-0000-4000-8000-000000000002', 4, 'waiting', true),
  ('a1000000-0000-4000-8000-000000000003', 'RLS second public room', 'a2000000-0000-4000-8000-000000000003', 4, 'waiting', false);

insert into public.multiplayer_room_secrets (room_id, password_hash)
values (
  'a1000000-0000-4000-8000-000000000002',
  extensions.crypt(encode(extensions.digest('private-pass', 'sha256'), 'hex'), extensions.gen_salt('bf'))
);

insert into public.room_players (room_id, user_id, is_ready)
values
  ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', true),
  ('a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', true),
  ('a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', true);

insert into public.room_state (room_id, status, question_index)
values
  ('a1000000-0000-4000-8000-000000000001', 'waiting', 0),
  ('a1000000-0000-4000-8000-000000000002', 'waiting', 0);

insert into public.room_chat_messages (room_id, user_id, content)
values
  ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'room A message'),
  ('a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'room B message');

select ok(not has_table_privilege('anon', 'public.room_players', 'select'), 'anon cannot read player rows');
select ok(not has_table_privilege('anon', 'public.room_answers', 'select'), 'anon cannot read answers');
select ok(not has_table_privilege('authenticated', 'public.room_players', 'insert'), 'authenticated cannot directly insert players');
select ok(not has_table_privilege('authenticated', 'public.room_players', 'update'), 'authenticated cannot directly update scores or readiness');
select ok(not has_table_privilege('authenticated', 'public.room_answers', 'insert'), 'authenticated cannot directly insert answers');
select ok(not has_table_privilege('authenticated', 'public.room_answers', 'update'), 'authenticated cannot alter submitted answers');
select ok(not has_table_privilege('authenticated', 'public.room_answers', 'select'), 'authenticated cannot directly read submitted answers');
select ok(not has_table_privilege('anon', 'public.room_chat_messages', 'select'), 'anon cannot read room chat');
select ok(not has_table_privilege('authenticated', 'public.room_questions', 'select'), 'authenticated cannot inspect assigned question rows');
select ok(not has_table_privilege('authenticated', 'public.room_state', 'update'), 'authenticated cannot directly change game state');
select ok(not has_table_privilege('authenticated', 'public.room_chat_messages', 'insert'), 'authenticated must send chat through the RPC');
select ok(has_table_privilege('authenticated', 'public.multiplayer_rooms', 'select'), 'authenticated retains table-level room SELECT for Realtime');
select ok(not has_table_privilege('authenticated', 'public.multiplayer_room_secrets', 'select'), 'authenticated cannot read room password hashes');
select ok(not has_function_privilege('anon', 'public.multiplayer_join_room(uuid,text)', 'execute'), 'anon cannot invoke room join RPC');
select ok(has_function_privilege('authenticated', 'public.multiplayer_join_room(uuid,text)', 'execute'), 'authenticated can use validated room join RPC');
select ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public'
    and table_name = 'multiplayer_rooms'
    and column_name = 'password'
), 'room passwords are removed from the exposed room table');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);

select is((select count(*)::integer from public.multiplayer_rooms where id = 'a1000000-0000-4000-8000-000000000001'), 1, 'member can read own room');
select is((select count(*)::integer from public.multiplayer_rooms where id = 'a1000000-0000-4000-8000-000000000002'), 0, 'non-member cannot read private room');
select is((select count(*)::integer from public.room_state where room_id = 'a1000000-0000-4000-8000-000000000002'), 0, 'non-member cannot read another room state');
select is((select count(*)::integer from public.room_chat_messages where room_id = 'a1000000-0000-4000-8000-000000000002'), 0, 'non-member cannot read another room chat');
select is((select count(*)::integer from public.room_players where room_id = 'a1000000-0000-4000-8000-000000000002'), 0, 'non-member cannot read another private room roster');
select is((select count(*)::integer from public.multiplayer_rooms where id = 'a1000000-0000-4000-8000-000000000003'), 1, 'authenticated users can discover public rooms');
select is((select count(*)::integer from public.room_players where room_id = 'a1000000-0000-4000-8000-000000000003'), 1, 'public lobby roster remains visible');
select throws_ok(
  'select public.multiplayer_join_room(''a1000000-0000-4000-8000-000000000002'', ''wrong-pass'')',
  'P0001',
  'Incorrect password',
  'incorrect private-room password is rejected'
);
select is(public.multiplayer_join_room('a1000000-0000-4000-8000-000000000003', null), true, 'authenticated player can join a public waiting room');

reset role;
update public.multiplayer_rooms
set status = 'playing'
where id = 'a1000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select throws_ok(
  'select public.multiplayer_join_room(''a1000000-0000-4000-8000-000000000002'', ''private-pass'')',
  'P0001',
  'This match has already started',
  'new players cannot join an active match'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000002', true);
select is(public.multiplayer_join_room('a1000000-0000-4000-8000-000000000002', null), true, 'existing private-room member can reconnect without rejoining');
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);


select ok(not exists (
  select 1 from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (left(p.proname, 12) = 'multiplayer_' or p.proname = 'cleanup_expired_multiplayer_rooms')
    and p.prosecdef
    and not coalesce(p.proconfig, array[]::text[]) @> array['search_path=pg_catalog, auth']
), 'multiplayer SECURITY DEFINER RPCs use a fixed search path that resolves auth.uid safely');

select * from finish();
rollback;
