begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

select ok(to_regclass('public.guardian_consent_requests') is not null, 'guardian consent request records exist');
select ok((select relrowsecurity from pg_class where oid = 'public.guardian_consent_requests'::regclass), 'guardian consent requests have RLS enabled');
select ok(not has_table_privilege('authenticated', 'public.guardian_consent_requests', 'select'), 'clients cannot read guardian requests directly');
select ok(to_regclass('public.guardian_child_controls') is not null, 'parent-controlled feature settings exist');
select ok((select relrowsecurity from pg_class where oid = 'public.guardian_child_controls'::regclass), 'parent-controlled feature settings have RLS enabled');
select ok(not has_table_privilege('authenticated', 'public.guardian_child_controls', 'select'), 'clients cannot read guardian controls directly');
select ok(has_function_privilege('authenticated', 'public.create_guardian_consent_request(text)', 'EXECUTE'), 'learners can request guardian approval');
select ok(not has_function_privilege('anon', 'public.create_guardian_consent_request(text)', 'EXECUTE'), 'anonymous users cannot create guardian requests');
select ok(not has_function_privilege('anon', 'public.set_my_age_and_guardian(integer,text)', 'EXECUTE'), 'anonymous users cannot set learner age or guardian details');
select ok(not has_function_privilege('anon', 'public.get_guardian_consent_request(uuid)', 'EXECUTE'), 'anonymous users cannot inspect guardian requests');
select ok(not has_function_privilege('anon', 'public.approve_guardian_consent(uuid,boolean)', 'EXECUTE'), 'anonymous users cannot approve guardian requests');
select ok(not has_function_privilege('anon', 'public.reject_guardian_consent(uuid)', 'EXECUTE'), 'anonymous users cannot reject guardian requests');
select ok(not has_function_privilege('anon', 'public.list_guardian_children()', 'EXECUTE'), 'anonymous users cannot list linked children');
select ok(not has_function_privilege('anon', 'public.update_guardian_child_controls(uuid,boolean,boolean,boolean,boolean,boolean,boolean)', 'EXECUTE'), 'anonymous users cannot change parent controls');
select ok(not has_function_privilege('anon', 'public.revoke_guardian_consent(uuid)', 'EXECUTE'), 'anonymous users cannot revoke guardian consent');
select ok(has_function_privilege('authenticated', 'public.get_guardian_consent_request(uuid)', 'EXECUTE'), 'parent accounts can fetch a matching approval request through the guarded RPC');
select ok(has_function_privilege('authenticated', 'public.approve_guardian_consent(uuid,boolean)', 'EXECUTE'), 'parent accounts can approve through the guarded RPC');
select ok(has_function_privilege('authenticated', 'public.reject_guardian_consent(uuid)', 'EXECUTE'), 'parent accounts can decline through the guarded RPC');
select ok(has_function_privilege('authenticated', 'public.list_guardian_children()', 'EXECUTE'), 'parent accounts can list linked learners through the guarded RPC');
select ok(has_function_privilege('authenticated', 'public.update_guardian_child_controls(uuid,boolean,boolean,boolean,boolean,boolean,boolean)', 'EXECUTE'), 'parent accounts can update controls through the guarded RPC');
select ok(has_function_privilege('authenticated', 'public.revoke_guardian_consent(uuid)', 'EXECUTE'), 'parent accounts can revoke consent through the guarded RPC');
select ok(has_function_privilege('authenticated', 'public.is_current_user_feature_enabled(text)', 'EXECUTE'), 'learners can check their own parent-approved feature access');
select ok(not has_function_privilege('authenticated', 'public.is_user_feature_enabled(uuid,text)', 'EXECUTE'), 'clients cannot inspect another account parent-control flags');

select ok(has_function_privilege('authenticated', 'public.set_my_age_and_guardian(integer,text)', 'EXECUTE'), 'existing learners can complete age and guardian details through the guarded RPC');
select ok(has_function_privilege('authenticated', 'public.can_view_lobby_author(uuid)', 'EXECUTE'), 'lobby visibility is decided by a safe relationship-aware helper');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.lobby_messages'::regclass and tgname = 'guardian_lobby_chat_guard' and not tgisinternal), 'under-18 public lobby chat is blocked by a database trigger');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.room_players'::regclass and tgname = 'guardian_room_player_guard' and not tgisinternal), 'under-18 multiplayer room access is guarded by a database trigger');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.multiplayer_invites'::regclass and tgname = 'guardian_multiplayer_invite_guard' and not tgisinternal), 'multiplayer invitations require approved connections');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lobby_messages' and policyname = 'authenticated can view lobby' and qual like '%can_view_lobby_author%'), 'lobby message visibility is relationship-aware');
select ok(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_group_members' and policyname = 'group admin manages members'), 'broad group-member access policy is removed');
select ok(position('account_status' in pg_get_functiondef('public.has_role(uuid,public.app_role)'::regprocedure)) > 0, 'role checks deny suspended and banned accounts');

select ok(position('A separate, valid parent or guardian email is required' in pg_get_functiondef('public.set_my_age_and_guardian(integer,text)'::regprocedure)) > 0, 'existing learner age updates require a separate guardian email when under 18');
select ok(position('guardian_consent_status' in pg_get_functiondef('public.set_my_age_and_guardian(integer,text)'::regprocedure)) > 0, 'age updates explicitly reset guardian approval state');
select ok(position('v_existing_age < 18 and p_age >= 18' in pg_get_functiondef('public.set_my_age_and_guardian(integer,text)'::regprocedure)) > 0, 'a learner recorded as under 18 cannot self-promote through the age RPC');
select ok(position('for update' in lower(pg_get_functiondef('public.set_my_age_and_guardian(integer,text)'::regprocedure))) > 0, 'age classification is locked while the learner update is checked');
select ok(position('old.age < 18' in pg_get_functiondef('public.validate_guardian_consent()'::regprocedure)) > 0 and position('auth.uid() = old.id' in pg_get_functiondef('public.validate_guardian_consent()'::regprocedure)) > 0, 'the profile trigger blocks direct self-service age escalation and age clearing');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_guardian_consent_guard' and not tgisinternal), 'the guardian and age-integrity trigger remains installed');

select * from finish();
rollback;
