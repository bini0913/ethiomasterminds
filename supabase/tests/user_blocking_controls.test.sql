begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_blocks'::regclass),
  'user_blocks has row level security enabled'
);
select ok(has_table_privilege('authenticated', 'public.user_blocks', 'select'), 'authenticated users can read their own block list');
select ok(has_table_privilege('authenticated', 'public.user_blocks', 'insert'), 'authenticated users can create blocks');
select ok(has_table_privilege('authenticated', 'public.user_blocks', 'delete'), 'authenticated users can remove their own blocks');
select ok(not has_table_privilege('anon', 'public.user_blocks', 'select'), 'anonymous users cannot read blocks');
select ok(not has_table_privilege('anon', 'public.user_blocks', 'insert'), 'anonymous users cannot create blocks');
select ok(not has_function_privilege('anon', 'app_private.is_user_blocked(uuid,uuid)', 'execute'), 'anonymous users cannot inspect block state');
select ok(has_function_privilege('authenticated', 'app_private.is_user_blocked(uuid,uuid)', 'execute'), 'authenticated policy checks can inspect their own pair');
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='friends' and policyname='involved users can view unblocked friendships'),
  'friendship reads use the block-aware policy'
);
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='involved users can view unblocked messages'),
  'direct-message reads use the block-aware policy'
);
select ok(
  exists (select 1 from pg_trigger where tgname='reject_blocked_direct_message' and not tgisinternal),
  'direct-message inserts are checked against blocks'
);
select ok(
  exists (select 1 from pg_trigger where tgname='reject_blocked_multiplayer_invite' and not tgisinternal),
  'multiplayer invites are checked against blocks'
);
select ok(
  exists (select 1 from pg_trigger where tgname='reject_blocked_study_call_invite' and not tgisinternal),
  'Study Mode call invitations are checked against blocks'
);
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='social_posts' and policyname='users can view opted-in posts excluding blocked authors'),
  'social feed reads hide blocked authors'
);
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='followers' and policyname='users can view unblocked follows'),
  'follower reads respect blocks'
);
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='social_post_comments' and policyname='users can view visible comments excluding blocked authors'),
  'comments by blocked users are hidden'
);
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='lobby_messages' and policyname='authenticated can view unblocked lobby messages'),
  'lobby messages from blocked users are hidden'
);
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='room_chat_messages' and policyname='room members can view unblocked room chat'),
  'multiplayer room chat from blocked users is hidden'
);
select ok(
  exists (select 1 from pg_trigger where tgname='reject_blocked_social_comment' and not tgisinternal)
  and exists (select 1 from pg_trigger where tgname='reject_blocked_follow' and not tgisinternal),
  'social comments and follows are checked against blocks'
);

select * from finish();
rollback;
