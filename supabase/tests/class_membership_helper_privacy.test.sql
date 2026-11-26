begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
select ok(has_function_privilege('authenticated','public.is_student_in_class(uuid,uuid)','execute'),'class membership helper remains callable for RLS');
select ok(not has_function_privilege('anon','public.is_student_in_class(uuid,uuid)','execute'),'anon cannot query class membership helper');
select ok(
  position(
    'auth.uid() = ' || (select proargnames[1] from pg_proc where oid = 'public.is_student_in_class(uuid,uuid)'::regprocedure)
    in pg_get_functiondef('public.is_student_in_class(uuid,uuid)'::regprocedure)
  ) > 0,
  'student membership helper only accepts the caller as the student subject'
);
select ok(has_function_privilege('authenticated','public.is_teacher_of_class(uuid,uuid)','execute'),'teacher-class helper remains callable for RLS');
select ok(not has_function_privilege('anon','public.is_teacher_of_class(uuid,uuid)','execute'),'anon cannot query teacher-class helper');
select ok(
  position(
    'auth.uid() = ' || (select proargnames[1] from pg_proc where oid = 'public.is_teacher_of_class(uuid,uuid)'::regprocedure)
    in pg_get_functiondef('public.is_teacher_of_class(uuid,uuid)'::regprocedure)
  ) > 0,
  'teacher-class helper only accepts the caller as the teacher subject'
);
select * from finish();
rollback;
