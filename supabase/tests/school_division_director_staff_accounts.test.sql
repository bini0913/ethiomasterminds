begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select ok(
  to_regprocedure('public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text)') is not null,
  'division director staff account RPC exists'
);

select ok(
  (select prosecdef from pg_proc where oid='public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text)'::regprocedure),
  'staff account RPC runs with controlled definer privileges'
);

select ok(
  (select coalesce(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
   from pg_proc
   where oid='public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text)'::regprocedure),
  'staff account RPC pins an empty search path'
);

select ok(
  has_function_privilege('service_role','public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text)','EXECUTE'),
  'trusted provisioning service can call the RPC'
);

select ok(
  not has_function_privilege('authenticated','public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text)','EXECUTE'),
  'authenticated clients cannot directly call the privileged account RPC'
);

select ok(
  not has_function_privilege('anon','public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text)','EXECUTE'),
  'anonymous clients cannot call the account RPC'
);

select ok(
  (select proargnames @> ARRAY['p_actor_id','p_school_id','p_user_id','p_section_id','p_position']::text[]
   from pg_proc
   where oid='public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text)'::regprocedure),
  'RPC requires explicit actor, school, user, section and position scope'
);

select * from finish();
rollback;
