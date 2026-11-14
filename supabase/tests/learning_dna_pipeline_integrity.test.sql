begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

select ok(has_table_privilege('authenticated', 'public.question_attempts', 'SELECT'), 'students can read their own question-attempt history');
select ok(not has_table_privilege('authenticated', 'public.question_attempts', 'INSERT'), 'students cannot insert unverified question attempts directly');
select ok(not has_table_privilege('authenticated', 'public.question_attempts', 'UPDATE'), 'students cannot rewrite question-attempt history');
select ok(not has_table_privilege('authenticated', 'public.question_attempts', 'DELETE'), 'students cannot delete question-attempt history');
select ok(not has_table_privilege('anon', 'public.question_attempts', 'SELECT'), 'anonymous users cannot read question-attempt history');
select ok(not has_table_privilege('anon', 'public.question_attempts', 'INSERT'), 'anonymous users cannot insert question attempts');
select ok(has_table_privilege('authenticated', 'public.learning_dna', 'SELECT'), 'students can read their own Learning DNA report');
select ok(not has_table_privilege('authenticated', 'public.learning_dna', 'INSERT'), 'students cannot create or forge Learning DNA reports');
select ok(not has_table_privilege('authenticated', 'public.learning_dna', 'UPDATE'), 'students cannot edit generated Learning DNA reports');
select ok(not has_table_privilege('authenticated', 'public.learning_dna', 'DELETE'), 'students cannot delete Learning DNA reports');
select ok(not has_table_privilege('anon', 'public.learning_dna', 'SELECT'), 'anonymous users cannot read Learning DNA reports');
select ok(
  has_function_privilege('authenticated', 'public.submit_quiz_result_secure(uuid,jsonb,integer,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.submit_quiz_result_secure(uuid,jsonb,integer,uuid)', 'EXECUTE'),
  'only authenticated users can invoke the server-authoritative quiz submission'
);
select ok(
  position('insert into public.question_attempts' in lower(pg_get_functiondef('public.submit_quiz_result_secure(uuid,jsonb,integer,uuid)'::regprocedure))) > 0
  and position('p_answers ?' in lower(pg_get_functiondef('public.submit_quiz_result_secure(uuid,jsonb,integer,uuid)'::regprocedure))) > 0,
  'the secure quiz submission records only submitted question IDs for Learning DNA'
);

select * from finish();
rollback;
