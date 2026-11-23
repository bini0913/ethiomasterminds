BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

SELECT ok(NOT has_function_privilege('anon','public.cleanup_expired_multiplayer_rooms()','EXECUTE'),'anonymous users cannot invoke global multiplayer cleanup');
SELECT ok(NOT has_function_privilege('authenticated','public.cleanup_expired_multiplayer_rooms()','EXECUTE'),'signed-in users cannot invoke global multiplayer cleanup');
SELECT ok(has_function_privilege('service_role','public.cleanup_expired_multiplayer_rooms()','EXECUTE'),'trusted service role retains multiplayer cleanup access');
SELECT ok(has_function_privilege('postgres','public.cleanup_expired_multiplayer_rooms()','EXECUTE'),'database owner retains multiplayer cleanup access');
SELECT ok(NOT has_function_privilege('authenticated','public.cleanup_expired_multiplayer_rooms_trigger()','EXECUTE'),'signed-in users cannot invoke the trigger wrapper');

SELECT * FROM finish();
ROLLBACK;
