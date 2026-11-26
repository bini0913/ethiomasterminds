begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select ok(not has_table_privilege('authenticated', 'public.questions', 'select'),
  'authenticated clients no longer have table-wide question SELECT');
select ok(not has_column_privilege('authenticated', 'public.questions', 'correct_answer', 'select'),
  'students cannot read correct_answer through the Data API');
select ok(has_column_privilege('authenticated', 'public.questions', 'question_text', 'select'),
  'authenticated clients retain prompt access');
select ok(has_column_privilege('authenticated', 'public.questions', 'options', 'select'),
  'authenticated clients retain answer-option access');
select ok(has_function_privilege('authenticated', 'public.get_teacher_quiz_questions(uuid)', 'EXECUTE'),
  'authenticated users can call the authorization-guarded teacher answer-key RPC');
select ok(not has_function_privilege('anon', 'public.get_teacher_quiz_questions(uuid)', 'EXECUTE'),
  'anonymous users cannot call the teacher answer-key RPC');
select ok(position('public.has_role(v_user_id, ''teacher''::public.app_role)' in pg_get_functiondef('public.get_teacher_quiz_questions(uuid)'::regprocedure)) > 0,
  'teacher answer-key RPC requires an authorized teacher or administrator role');
select ok(position('public.school_can_manage_school_quiz(quiz.id)' in pg_get_functiondef('public.get_teacher_quiz_questions(uuid)'::regprocedure)) > 0,
  'school teacher answer-key access is scoped through the school quiz-management guard');

select * from finish();
rollback;
