begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

-- These fixtures are isolated to this transaction and rolled back at the end.
insert into public.multiplayer_rooms (id, name, host_id, max_players, status, password)
values
  ('a1000000-0000-4000-8000-000000000001', 'RLS public room', 'a2000000-0000-4000-8000-000000000001', 4, 'waiting', null),
  ('a1000000-0000-4000-8000-000000000002', 'RLS private room', 'a2000000-0000-4000-8000-000000000002', 4, 'waiting', 'private-pass');

insert into public.room_players (room_id, user_id, is_ready)
values
  ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', true),
  ('a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', true);

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
select ok(not has_table_privilege('authenticated', 'public.room_questions', 'select'), 'authenticated cannot inspect assigned question rows');
select ok(not has_table_privilege('authenticated', 'public.room_state', 'update'), 'authenticated cannot directly change game state');
select ok(not has_table_privilege('authenticated', 'public.room_chat_messages', 'insert'), 'authenticated must send chat through the RPC');
select ok(has_column_privilege('authenticated', 'public.multiplayer_rooms', 'id', 'select'), 'authenticated can read safe room identifiers');
select ok(not has_column_privilege('authenticated', 'public.multiplayer_rooms', 'password', 'select'), 'room passwords are not selectable');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);

select is((select count(*)::integer from public.multiplayer_rooms where id = 'a1000000-0000-4000-8000-000000000001'), 1, 'member can read own room');
select is((select count(*)::integer from public.multiplayer_rooms where id = 'a1000000-0000-4000-8000-000000000002'), 0, 'non-member cannot read private room');
select is((select count(*)::integer from public.room_state where room_id = 'a1000000-0000-4000-8000-000000000002'), 0, 'non-member cannot read another room state');
select is((select count(*)::integer from public.room_chat_messages where room_id = 'a1000000-0000-4000-8000-000000000002'), 0, 'non-member cannot read another room chat');
select is((select count(*)::integer from public.room_players where room_id = 'a1000000-0000-4000-8000-000000000002'), 0, 'non-member cannot read another private room roster');

select * from finish();
rollback;
