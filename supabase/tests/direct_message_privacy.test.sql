begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select ok(not has_table_privilege('anon', 'public.messages', 'select'), 'anon cannot read direct messages');
select ok(not has_table_privilege('anon', 'public.messages', 'insert'), 'anon cannot insert direct messages');
select ok(not has_table_privilege('authenticated', 'public.messages', 'insert'), 'direct messages require the send RPC');
select ok(not has_table_privilege('authenticated', 'public.messages', 'update'), 'direct-message updates require an authorized RPC');
select ok(not has_table_privilege('authenticated', 'public.messages', 'delete'), 'direct-message deletes are not client-writable');
select ok(has_table_privilege('authenticated', 'public.messages', 'select'), 'authenticated users retain direct-message reads');

select ok(not has_table_privilege('anon', 'public.friends', 'select'), 'anon cannot read friendships');
select ok(not has_table_privilege('anon', 'public.friends', 'insert'), 'anon cannot create friendship requests');
select ok(not has_table_privilege('authenticated', 'public.friends', 'insert'), 'friend requests require the send RPC');
select ok(not has_table_privilege('authenticated', 'public.friends', 'update'), 'friendship responses require the response RPC');
select ok(not has_table_privilege('authenticated', 'public.friends', 'delete'), 'friend removal requires the remove RPC');
select ok(has_table_privilege('authenticated', 'public.friends', 'select'), 'authenticated users retain friendship reads');

select ok(not has_table_privilege('anon', 'public.user_presence', 'select'), 'anon cannot read presence');
select ok(not has_table_privilege('anon', 'public.user_presence', 'insert'), 'anon cannot publish presence');
select ok(has_table_privilege('authenticated', 'public.user_presence', 'select'), 'authenticated users retain presence reads');
select ok(has_table_privilege('authenticated', 'public.user_presence', 'insert'), 'authenticated users retain own presence heartbeats');
select ok(has_table_privilege('authenticated', 'public.user_presence', 'update'), 'authenticated users retain own presence updates');
select ok(not has_table_privilege('authenticated', 'public.user_presence', 'delete'), 'presence rows cannot be client-deleted');

select * from finish();
rollback;
