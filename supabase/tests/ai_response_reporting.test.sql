begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select ok(to_regclass('public.ai_response_report_evidence') is not null, 'AI response report evidence table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_response_report_evidence'::regclass), 'AI response evidence has RLS enabled');
select ok(not has_table_privilege('authenticated', 'public.ai_response_report_evidence', 'select'), 'learners cannot read private AI response evidence directly');
select ok(not has_table_privilege('authenticated', 'public.ai_response_report_evidence', 'insert'), 'learners cannot forge AI response evidence rows');
select ok(not has_table_privilege('anon', 'public.ai_response_report_evidence', 'select'), 'anonymous users cannot read AI response evidence');
select ok(has_function_privilege('authenticated', 'public.submit_ai_response_report(text,text,text,text,uuid)', 'EXECUTE'), 'signed-in learners can submit AI response reports through the guarded RPC');
select ok(not has_function_privilege('anon', 'public.submit_ai_response_report(text,text,text,text,uuid)', 'EXECUTE'), 'anonymous users cannot submit AI response reports');
select ok(position('ai_response' in pg_get_functiondef('public.enforce_report_submission()'::regprocedure)) > 0, 'report validation recognises AI response evidence references');
select ok(position('ai_response' in pg_get_functiondef('public.moderation_get_report_context(uuid[])'::regprocedure)) > 0, 'moderator context includes the reported AI response snapshot');
select ok(not has_function_privilege('authenticated', 'public.enforce_report_submission()', 'EXECUTE'), 'clients cannot invoke the report validation trigger function directly');

select * from finish();
rollback;
