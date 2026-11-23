BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

SELECT ok(NOT has_function_privilege('anon','public.add_chat_group_member(uuid,uuid)','EXECUTE'),'anonymous users cannot add chat-group members');
SELECT ok(has_function_privilege('authenticated','public.add_chat_group_member(uuid,uuid)','EXECUTE'),'authenticated group owners/admins can add chat-group members through guarded RPC');
SELECT ok(NOT has_function_privilege('anon','public.create_chat_group(text,text,text)','EXECUTE'),'anonymous users cannot create chat groups');
SELECT ok(has_function_privilege('authenticated','public.create_chat_group(text,text,text)','EXECUTE'),'authenticated users can create chat groups through guarded RPC');
SELECT ok(NOT has_function_privilege('anon','public.join_chat_group(uuid)','EXECUTE'),'anonymous users cannot join chat groups');
SELECT ok(has_function_privilege('authenticated','public.join_chat_group(uuid)','EXECUTE'),'authenticated users can join permitted chat groups');
SELECT ok(NOT has_function_privilege('anon','public.leave_chat_group(uuid)','EXECUTE'),'anonymous users cannot leave chat groups');
SELECT ok(has_function_privilege('authenticated','public.leave_chat_group(uuid)','EXECUTE'),'authenticated users can leave chat groups');
SELECT ok(NOT has_function_privilege('anon','public.send_group_message(uuid,text,text,uuid,text)','EXECUTE'),'anonymous users cannot send group messages');
SELECT ok(has_function_privilege('authenticated','public.send_group_message(uuid,text,text,uuid,text)','EXECUTE'),'authenticated group members can send messages through guarded RPC');
SELECT ok(NOT has_function_privilege('anon','public.cleanup_expired_multiplayer_rooms_trigger()','EXECUTE'),'anonymous users cannot invoke the multiplayer cleanup trigger wrapper');
SELECT ok(NOT has_function_privilege('authenticated','public.cleanup_expired_multiplayer_rooms_trigger()','EXECUTE'),'authenticated users cannot invoke the multiplayer cleanup trigger wrapper');
SELECT ok(position('Authentication required' in pg_get_functiondef('public.add_chat_group_member(uuid,uuid)'::regprocedure)) > 0,'group membership RPC verifies authentication internally');
SELECT ok(position('Authentication required' in pg_get_functiondef('public.create_chat_group(text,text,text)'::regprocedure)) > 0,'group creation RPC verifies authentication internally');
SELECT ok(position('must be a group member' in pg_get_functiondef('public.send_group_message(uuid,text,text,uuid,text)'::regprocedure)) > 0,'group messaging RPC verifies membership internally');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgfoid='public.cleanup_expired_multiplayer_rooms_trigger()'::regprocedure AND NOT tgisinternal),'cleanup wrapper remains installed for its database trigger');

SELECT * FROM finish();
ROLLBACK;
