begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select ok(
  to_regprocedure('public.school_teacher_parent_contacts(uuid)') is not null,
  'teacher parent contact lookup exists'
);

select ok(
  pg_get_function_result('public.school_teacher_parent_contacts(uuid)'::regprocedure)
    ilike '%parent_membership_id uuid%parent_name text%',
  'teacher parent contact lookup returns the portal contract'
);

select ok(
  has_function_privilege('authenticated', 'public.school_teacher_parent_contacts(uuid)', 'EXECUTE'),
  'authenticated teachers can call the guarded parent contact lookup'
);

select ok(
  not has_function_privilege('anon', 'public.school_teacher_parent_contacts(uuid)', 'EXECUTE'),
  'anonymous users cannot call the parent contact lookup'
);

select ok(
  pg_get_functiondef('public.school_create_conversation(uuid,text,uuid,uuid,uuid[],text)'::regprocedure)
    like '%ARRAY[v_creator_id, p_student_membership_id]%',
  'direct conversations always include the selected student as a participant'
);

select ok(
  pg_get_functiondef('public.school_create_conversation(uuid,text,uuid,uuid,uuid[],text)'::regprocedure)
    like '%Teacher participants must be assigned to the selected student section%',
  'direct conversation participants remain restricted to the assigned section'
);

select * from finish();
rollback;
