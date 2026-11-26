begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select ok(
  not has_table_privilege('anon', 'public.questions', 'SELECT'),
  'anonymous users cannot read question rows'
);
select ok(
  not has_table_privilege('authenticated', 'public.questions', 'SELECT'),
  'students and other clients do not have table-wide question SELECT'
);
select ok(
  not has_column_privilege('authenticated', 'public.questions', 'correct_answer', 'SELECT'),
  'authenticated users cannot directly read correct answer keys'
);
select ok(
  has_column_privilege('authenticated', 'public.questions', 'question_text', 'SELECT'),
  'authenticated students can still read question prompts'
);
select ok(
  has_column_privilege('authenticated', 'public.questions', 'id', 'SELECT'),
  'authenticated clients can still read question identifiers'
);
select ok(
  not has_table_privilege('authenticated', 'public.questions', 'TRUNCATE'),
  'authenticated clients cannot truncate the question bank'
);
select ok(
  not has_table_privilege('authenticated', 'public.questions', 'TRIGGER'),
  'authenticated clients cannot attach triggers to the question bank'
);
select ok(
  has_function_privilege('authenticated', 'public.get_question_authoring_bank(uuid[])', 'EXECUTE'),
  'authenticated authoring roles can use the guarded answer-key RPC'
);
select ok(
  not has_function_privilege('anon', 'public.get_question_authoring_bank(uuid[])', 'EXECUTE'),
  'anonymous users cannot retrieve question answer keys'
);
select ok(
  position('public.has_role(v_user_id, ''teacher''::public.app_role)' in pg_get_functiondef('public.get_question_authoring_bank(uuid[])'::regprocedure)) > 0,
  'the authoring RPC explicitly requires an authorized teacher or higher role'
);
select ok(
  position('public.school_can_manage_school_quiz(quiz.id)' in pg_get_functiondef('public.get_question_authoring_bank(uuid[])'::regprocedure)) > 0,
  'the authoring RPC preserves school quiz management authorization'
);
select ok(
  pg_get_function_result('public.get_student_question_bank(uuid[])'::regprocedure) not ilike '%correct_answer%',
  'the student question-bank RPC never returns the answer key'
);
select ok(
  (select proconfig @> array['search_path=pg_catalog, public'] from pg_proc where oid = 'public.get_question_authoring_bank(uuid[])'::regprocedure),
  'the authoring RPC uses a fixed search path'
);

select * from finish();
rollback;
