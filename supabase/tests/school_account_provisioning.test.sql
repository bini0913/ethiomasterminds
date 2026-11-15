begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select ok(has_function_privilege(
  'service_role',
  'public.school_attach_account(uuid,uuid,uuid,text,text,text,integer,uuid,bigint,uuid[],uuid[],jsonb)',
  'execute'
), 'trusted service role can attach school accounts');

select ok(not has_function_privilege(
  'authenticated',
  'public.school_attach_account(uuid,uuid,uuid,text,text,text,integer,uuid,bigint,uuid[],uuid[],jsonb)',
  'execute'
), 'clients cannot call the privileged account attachment function');

select ok(has_function_privilege(
  'service_role',
  'public.school_link_parent_students(uuid,uuid,uuid[])',
  'execute'
), 'trusted service role can link a parent to multiple students');

select ok(not has_function_privilege(
  'authenticated',
  'public.school_link_parent_students(uuid,uuid,uuid[])',
  'execute'
), 'clients cannot bypass parent-link provisioning checks');

select ok(has_function_privilege(
  'authenticated',
  'public.school_next_student_number(uuid,text)',
  'execute'
), 'authenticated school staff can allocate grade-based student numbers');

select ok(exists (
  select 1 from information_schema.columns
  where table_schema = 'public'
    and table_name = 'school_memberships'
    and column_name = 'age_at_enrollment'
), 'student age at enrollment is stored separately from the permanent username');

select ok(exists (
  select 1 from pg_trigger
  where tgname = 'school_protect_managed_profile_fields'
    and tgrelid = 'public.profiles'::regclass
    and not tgisinternal
), 'school usernames cannot be changed through the profile editor');

select ok(exists (
  select 1 from pg_trigger
  where tgname = 'school_sync_profile_grade'
    and tgrelid = 'public.school_memberships'::regclass
    and not tgisinternal
), 'profile grade stays synchronized with school enrollment changes');

select ok(exists (
  select 1 from pg_trigger
  where tgname = 'school_sync_homeroom_teacher_field'
    and tgrelid = 'public.school_teacher_assignments'::regclass
    and not tgisinternal
), 'homeroom display field follows the authoritative assignment record');

select ok(not has_table_privilege('authenticated', 'public.school_student_id_sequences', 'SELECT'), 'student ID sequences are not directly exposed to clients');

select * from finish();
rollback;
