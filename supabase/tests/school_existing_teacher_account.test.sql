begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select ok(
  to_regprocedure('public.school_attach_existing_teacher_account(uuid,uuid,uuid)') is not null,
  'existing-account teacher attachment RPC exists'
);
select ok(
  has_function_privilege('service_role','public.school_attach_existing_teacher_account(uuid,uuid,uuid)','EXECUTE'),
  'only the trusted account service can execute the attachment RPC'
);
select ok(
  not has_function_privilege('authenticated','public.school_attach_existing_teacher_account(uuid,uuid,uuid)','EXECUTE'),
  'authenticated clients cannot bypass the trusted account service'
);
select ok(
  not has_function_privilege('anon','public.school_attach_existing_school_teacher_account(uuid,uuid,uuid)','EXECUTE'),
  'anonymous clients cannot attach existing accounts'
);
select ok(
  position('school_role = ''manager''' in pg_get_functiondef('public.school_attach_existing_teacher_account(uuid,uuid,uuid)'::regprocedure)) > 0
  AND position('appointment.position = ''main_director''' in pg_get_functiondef('public.school_attach_existing_teacher_account(uuid,uuid,uuid)'::regprocedure)) > 0
  AND position('IF NOT (v_is_manager OR v_is_main_director)' in pg_get_functiondef('public.school_attach_existing_teacher_account(uuid,uuid,uuid)'::regprocedure)) > 0,
  'existing teacher attachment requires an active school Manager or appointed Main Director'
);
select ok(
  position('already has a membership in this school' in pg_get_functiondef('public.school_attach_existing_teacher_account(uuid,uuid,uuid)'::regprocedure)) > 0,
  'duplicate school memberships are rejected'
);
select ok(
  position('school_existing_teacher_account_attached' in pg_get_functiondef('public.school_attach_existing_teacher_account(uuid,uuid,uuid)'::regprocedure)) > 0,
  'existing-account attachment is audited'
);
select ok(
  position('user_roles' in pg_get_functiondef('public.school_attach_existing_teacher_account(uuid,uuid,uuid)'::regprocedure)) = 0,
  'attaching a school teacher does not change the account global role'
);

select * from finish();
rollback;
