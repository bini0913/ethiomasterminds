begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select ok(not has_function_privilege('anon', 'public.manager_set_student_status(uuid,text,text)', 'execute'), 'anonymous users cannot execute student moderation');
select ok(has_function_privilege('authenticated', 'public.manager_set_student_status(uuid,text,text)', 'execute'), 'authenticated staff can call guarded student moderation');
select ok(not has_function_privilege('anon', 'public.submit_quiz_result_secure(uuid,jsonb,integer,uuid)', 'execute'), 'anonymous users cannot submit quiz results');
select ok(has_function_privilege('authenticated', 'public.submit_quiz_result_secure(uuid,jsonb,integer,uuid)', 'execute'), 'authenticated students can submit scored quiz results');
select ok(position('Authentication required' in pg_get_functiondef('public.submit_quiz_result_secure(uuid,jsonb,integer,uuid)'::regprocedure)) > 0, 'quiz submission requires an authenticated user');
select ok(position('student_id is distinct from v_user_id' in lower(pg_get_functiondef('public.submit_quiz_result_secure(uuid,jsonb,integer,uuid)'::regprocedure))) > 0, 'submission idempotency checks ownership');
select ok(position('on conflict (submission_id) do nothing' in lower(pg_get_functiondef('public.submit_quiz_result_secure(uuid,jsonb,integer,uuid)'::regprocedure))) > 0, 'quiz submission idempotency is concurrency-safe');
select ok(position('for update' in lower(pg_get_functiondef('public.claim_quiz_reward(uuid)'::regprocedure))) > 0, 'quiz reward claim locks the result row against duplicate concurrent claims');
select ok(position('student_id = v_user_id' in lower(pg_get_functiondef('public.claim_quiz_reward(uuid)'::regprocedure))) > 0, 'quiz reward claim is scoped to the authenticated student');

select * from finish();
rollback;
