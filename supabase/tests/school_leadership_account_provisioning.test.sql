begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select ok(
  to_regprocedure('public.school_attach_leadership_account(uuid,uuid,uuid,text,text,text)') is not null,
  'Manager leadership account RPC exists'
);
select ok(
  (select prosecdef from pg_proc where oid='public.school_attach_leadership_account(uuid,uuid,uuid,text,text,text)'::regprocedure),
  'Manager leadership account RPC is SECURITY DEFINER'
);
select ok(
  (select coalesce(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
   from pg_proc where oid='public.school_attach_leadership_account(uuid,uuid,uuid,text,text,text)'::regprocedure),
  'Manager leadership account RPC pins an empty search path'
);
select ok(
  has_function_privilege('service_role','public.school_attach_leadership_account(uuid,uuid,uuid,text,text,text)','EXECUTE')
  and not has_function_privilege('authenticated','public.school_attach_leadership_account(uuid,uuid,uuid,text,text,text)','EXECUTE')
  and not has_function_privilege('anon','public.school_attach_leadership_account(uuid,uuid,uuid,text,text,text)','EXECUTE'),
  'only the trusted provisioning service can call the Manager leadership RPC'
);
select ok(
  to_regprocedure('public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text,uuid)') is not null,
  'Division Director staff account RPC exists'
);
select ok(
  (select prosecdef from pg_proc where oid='public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text,uuid)'::regprocedure),
  'Division Director staff account RPC is SECURITY DEFINER'
);
select ok(
  (select coalesce(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
   from pg_proc where oid='public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text,uuid)'::regprocedure),
  'Division Director staff account RPC pins an empty search path'
);
select ok(
  has_function_privilege('service_role','public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text,uuid)','EXECUTE'),
  'only the trusted provisioning service can call the Division Director RPC'
);
select ok(
  (select proargnames @> ARRAY['p_actor_id','p_school_id','p_user_id','p_position','p_division_scope']::text[]
   from pg_proc where oid='public.school_attach_leadership_account(uuid,uuid,uuid,text,text,text)'::regprocedure),
  'Manager RPC explicitly scopes the actor, school, account and leadership position'
);
select ok(
  (select proargnames @> ARRAY['p_actor_id','p_school_id','p_user_id','p_section_id','p_position','p_team_leader_appointment_id']::text[]
   from pg_proc where oid='public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text,uuid)'::regprocedure),
  'Division Director RPC explicitly scopes the actor, school, account, class and position'
);
select ok(
  (select pg_get_functiondef('public.school_attach_leadership_account(uuid,uuid,uuid,text,text,text)'::regprocedure) ilike '%school_role = ''manager''%'),
  'Manager leadership RPC checks an active school Manager membership'
);
select ok(
  (select pg_get_functiondef('public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text,uuid)'::regprocedure) ilike '%kg_director%'
   and pg_get_functiondef('public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text,uuid)'::regprocedure) ilike '%school_division_grade_mappings%'),
  'Division Director staff RPC verifies a division appointment and mapped grade'
);

select * from finish();
rollback;
