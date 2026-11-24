begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

select ok((select relrowsecurity from pg_class where oid='public.guardian_consent_requests'::regclass), 'guardian consent requests have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.guardian_social_controls'::regclass), 'guardian social controls have RLS enabled');
select ok(not has_table_privilege('authenticated','public.guardian_consent_requests','select'), 'students and guardians cannot query consent requests directly');
select ok(not has_table_privilege('authenticated','public.guardian_social_controls','select'), 'students and guardians cannot query control rows directly');
select ok(has_function_privilege('authenticated','public.request_guardian_consent()','execute'), 'students can request verified guardian approval');
select ok(not has_function_privilege('anon','public.request_guardian_consent()','execute'), 'anonymous users cannot request guardian approval');
select ok(has_function_privilege('authenticated','public.approve_guardian_consent(uuid)','execute'), 'verified guardian sessions can approve a request');
select ok(has_function_privilege('authenticated','public.get_my_social_access()','execute'), 'learners can read only their own social access flags');
select ok(has_function_privilege('authenticated','public.get_my_guardian_students()','execute'), 'guardians can list only their linked learners');
select ok(has_function_privilege('authenticated','public.update_guardian_social_controls(uuid,boolean,boolean,boolean,boolean,boolean,boolean)','execute'), 'guardians can update granular social controls');
select ok(has_function_privilege('authenticated','public.revoke_guardian_consent(uuid)','execute'), 'guardians can revoke consent');
select ok(not has_function_privilege('authenticated','app_private.enforce_guardian_social_permission()','execute'), 'clients cannot invoke the guardian enforcement trigger function');
select ok(has_function_privilege('authenticated','app_private.guardian_allows(uuid,text)','execute'), 'RLS can evaluate guardian permissions');
select ok(not has_function_privilege('anon','app_private.guardian_allows(uuid,text)','execute'), 'anonymous users cannot inspect guardian permissions');
select is(app_private.guardian_allows('00000000-0000-0000-0000-000000000000'::uuid,'friends'), false, 'unknown accounts default to no social access');
select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='guardian_social_controls' and column_name='allow_friends' and column_default like '%false%')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='guardian_social_controls' and column_name='allow_direct_messages' and column_default like '%false%')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='guardian_social_controls' and column_name='allow_group_chat' and column_default like '%false%')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='guardian_social_controls' and column_name='allow_public_posts' and column_default like '%false%')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='guardian_social_controls' and column_name='allow_multiplayer' and column_default like '%false%')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='guardian_social_controls' and column_name='allow_study_calls' and column_default like '%false%'),
  'every guardian-controlled feature defaults off'
);
select ok(exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='profiles_guardian_consent_guard' and not tgisinternal), 'profile consent is guarded by a verified approval trigger');
select ok(exists(select 1 from pg_trigger where tgrelid='public.social_posts'::regclass and tgname='guardian_check_social_posts' and not tgisinternal), 'social post creation and updates are guardian-gated');
select ok(exists(select 1 from pg_trigger where tgrelid='public.messages'::regclass and tgname='guardian_check_messages' and not tgisinternal), 'direct messages are guardian-gated');
select ok(exists(select 1 from pg_trigger where tgrelid='public.group_messages'::regclass and tgname='guardian_check_group_messages' and not tgisinternal), 'group messages are guardian-gated');
select ok(
  exists(select 1 from pg_policies where schemaname='public' and tablename='friends' and policyname='involved users can view unblocked friendships' and qual like '%guardian_allows%')
  and exists(select 1 from pg_policies where schemaname='public' and tablename='social_posts' and policyname='users can view opted-in posts excluding blocked authors' and qual like '%guardian_allows%')
  and exists(select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='involved users can view unblocked messages' and qual like '%guardian_allows%'),
  'friend, social, and direct-message reads respect guardian controls'
);
select ok(
  exists(select 1 from pg_policies where schemaname='public' and tablename='chat_groups' and policyname='members view guardian-enabled groups')
  and exists(select 1 from pg_policies where schemaname='public' and tablename='study_call_rooms' and policyname='participants view guardian-enabled study call rooms')
  and exists(select 1 from pg_policies where schemaname='public' and tablename='tournament_participants' and policyname='authenticated can view participants' and qual like '%guardian_allows%'),
  'group, study-call, and tournament reads respect guardian controls'
);

select * from finish();
rollback;
