begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_policy_acceptances'::regclass),
  'policy acceptances have row level security enabled'
);
select ok(has_table_privilege('authenticated', 'public.user_policy_acceptances', 'select'), 'users can read their own acceptance records');
select ok(has_table_privilege('authenticated', 'public.user_policy_acceptances', 'insert'), 'users can accept the current guidelines');
select ok(not has_table_privilege('authenticated', 'public.user_policy_acceptances', 'update'), 'users cannot rewrite acceptance history');
select ok(not has_table_privilege('authenticated', 'public.user_policy_acceptances', 'delete'), 'users cannot erase acceptance history');
select ok(not has_table_privilege('anon', 'public.user_policy_acceptances', 'select'), 'anonymous users cannot read acceptance records');
select ok(
  exists (select 1 from pg_trigger where tgname='require_guidelines_for_social_posts' and not tgisinternal),
  'social post creation requires current guidelines acceptance'
);
select ok(
  exists (select 1 from pg_trigger where tgname='require_guidelines_for_direct_messages' and not tgisinternal)
  and exists (select 1 from pg_trigger where tgname='require_guidelines_for_group_messages' and not tgisinternal),
  'direct and group messages require current guidelines acceptance'
);
select ok(
  exists (select 1 from pg_trigger where tgname='require_guidelines_for_social_comments' and not tgisinternal),
  'comment creation requires current guidelines acceptance'
);
select ok(
  exists (select 1 from pg_trigger where tgname='require_guidelines_for_lobby_messages' and not tgisinternal)
  and exists (select 1 from pg_trigger where tgname='require_guidelines_for_room_chat' and not tgisinternal),
  'multiplayer chat requires current guidelines acceptance'
);

select * from finish();
rollback;
