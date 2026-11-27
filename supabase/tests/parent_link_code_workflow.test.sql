BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);

SELECT has_column('public', 'parent_links', 'parent_id', 'parent links retain the parent owner column');
SELECT ok(
  (SELECT is_nullable = 'YES'
     FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parent_links'
      AND column_name = 'parent_id'),
  'pending parent links may be created before a parent claims them'
);
SELECT ok(to_regprocedure('public.create_parent_link_code()') IS NOT NULL, 'student code-generation RPC exists');
SELECT ok(to_regprocedure('public.claim_parent_link_code(text)') IS NOT NULL, 'parent claim RPC exists');
SELECT ok(has_function_privilege('authenticated', 'public.create_parent_link_code()', 'EXECUTE'), 'authenticated users can invoke code generation');
SELECT ok(has_function_privilege('authenticated', 'public.claim_parent_link_code(text)', 'EXECUTE'), 'authenticated users can invoke code claiming');
SELECT ok(NOT has_function_privilege('anon', 'public.create_parent_link_code()', 'EXECUTE'), 'anonymous users cannot generate codes');
SELECT ok(NOT has_function_privilege('anon', 'public.claim_parent_link_code(text)', 'EXECUTE'), 'anonymous users cannot claim codes');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.create_parent_link_code()'::regprocedure), 'code generation runs as a controlled security definer');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.claim_parent_link_code(text)'::regprocedure), 'code claiming runs as a controlled security definer');

SELECT * FROM finish();
ROLLBACK;
