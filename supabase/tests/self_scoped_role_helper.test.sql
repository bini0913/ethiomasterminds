begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select ok(
  has_function_privilege('authenticated', 'public.has_role(uuid,public.app_role)', 'EXECUTE'),
  'authenticated policies can continue using the self-scoped role helper'
);
select ok(
  not has_function_privilege('anon', 'public.has_role(uuid,public.app_role)', 'EXECUTE'),
  'anonymous users cannot inspect roles'
);
select ok(
  not has_function_privilege('authenticated', 'private.has_role_for_user(uuid,public.app_role)', 'EXECUTE'),
  'authenticated users cannot call the trusted cross-account role helper'
);
select ok(
  has_function_privilege('service_role', 'private.has_role_for_user(uuid,public.app_role)', 'EXECUTE'),
  'trusted backend operations retain cross-account role checks'
);
select ok(
  position('_user_id is distinct from v_current_user_id' in pg_get_functiondef('public.has_role(uuid,public.app_role)'::regprocedure)) > 0,
  'the public role helper rejects checks for accounts other than the caller'
);
select ok(
  position('private.has_role_for_user(p_user_id' in pg_get_functiondef('public.is_user_feature_enabled(uuid,text)'::regprocedure)) > 0,
  'internal guardian feature checks retain trusted cross-account role evaluation'
);
select ok(
  position('private.has_role_for_user(p_user_id' in pg_get_functiondef('public.extreme_admin_set_super_admin(uuid,boolean,text)'::regprocedure)) > 0,
  'Extreme Admin role assignment retains its protected target-account check'
);

do $$
declare
  v_caller_id uuid := gen_random_uuid();
  v_target_id uuid := gen_random_uuid();
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', v_caller_id::text, true);
  insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (
    v_caller_id, 'authenticated', 'authenticated',
    'role-self-' || v_caller_id::text || '@example.test', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name','Role Self Test','username','roleself' || left(replace(v_caller_id::text,'-',''),10),'age','20'),
    now(), now()
  );

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', v_target_id::text, true);
  insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (
    v_target_id, 'authenticated', 'authenticated',
    'role-target-' || v_target_id::text || '@example.test', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name','Role Target Test','username','roletarget' || left(replace(v_target_id::text,'-',''),10),'age','20'),
    now(), now()
  );

  insert into public.user_roles(user_id, role)
  values (v_target_id, 'admin'::public.app_role)
  on conflict (user_id, role) do nothing;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_caller_id::text, true);

  if not public.has_role(v_caller_id, 'student'::public.app_role) then
    raise exception 'Self role lookup unexpectedly failed';
  end if;
  if public.has_role(v_target_id, 'admin'::public.app_role) then
    raise exception 'Public role helper exposed another account role';
  end if;
  if not private.has_role_for_user(v_target_id, 'admin'::public.app_role) then
    raise exception 'Trusted cross-account role lookup unexpectedly failed';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end;
$$;
select ok(true, 'runtime regression proves public role checks are self-only while trusted internal checks remain available');

select * from finish();
rollback;
