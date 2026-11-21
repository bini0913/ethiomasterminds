BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.school_networks'::regclass), 'school_networks has row-level security enabled');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'school_networks' AND policyname = 'school_networks_network_authority_read' AND cmd = 'SELECT'), 'network records have an authority-only read policy');
SELECT ok(has_table_privilege('authenticated', 'public.school_networks', 'SELECT'), 'authenticated clients retain SELECT privilege subject to RLS');
SELECT ok(NOT has_table_privilege('anon', 'public.school_networks', 'SELECT'), 'anonymous clients cannot select network records');
SELECT ok(NOT has_table_privilege('authenticated', 'public.school_networks', 'INSERT'), 'authenticated clients cannot directly insert network records');
SELECT ok(NOT has_table_privilege('authenticated', 'public.school_networks', 'UPDATE'), 'authenticated clients cannot directly update network records');
SELECT ok(NOT has_table_privilege('authenticated', 'public.school_networks', 'DELETE'), 'authenticated clients cannot directly delete network records');
SELECT ok(NOT has_function_privilege('anon', 'public._is_network_authority()', 'EXECUTE'), 'anonymous clients cannot execute the network-authority helper');
SELECT ok(has_function_privilege('authenticated', 'public._is_network_authority()', 'EXECUTE'), 'authenticated RLS policies can execute the network-authority helper');
SELECT ok(NOT has_function_privilege('anon', 'public.school_network_id()', 'EXECUTE'), 'anonymous clients cannot execute the network-id helper');

SELECT * FROM finish();
ROLLBACK;
