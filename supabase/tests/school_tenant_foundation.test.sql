begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

select ok(exists (
  select 1 from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  where t.typname = 'app_role' and e.enumlabel = 'parent'
), 'parent is a first-class application role');

select ok(to_regclass('public.schools') is not null, 'schools tenant table exists');
select ok(to_regclass('public.school_memberships') is not null, 'school memberships table exists');
select ok(to_regclass('public.school_academic_years') is not null, 'school academic years table exists');
select ok(to_regclass('public.school_sections') is not null, 'school sections table exists');
select ok(to_regclass('public.school_teacher_assignments') is not null, 'teacher assignments table exists');
select ok(to_regclass('public.school_parent_student_links') is not null, 'parent-to-student links table exists');
select ok(to_regclass('public.school_student_id_sequences') is not null, 'grade-based student ID sequences table exists');
select ok(to_regclass('public.school_record_events') is not null, 'school enrollment history table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.schools'::regclass), 'schools has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_memberships'::regclass), 'school memberships has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_academic_years'::regclass), 'school academic years has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_sections'::regclass), 'school sections has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_teacher_assignments'::regclass), 'teacher assignments has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_parent_student_links'::regclass), 'parent links has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_student_id_sequences'::regclass), 'student ID sequences has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_record_events'::regclass), 'school history has RLS enabled');

select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'school_one_active_student_enrollment'), 'a student can have only one active school enrollment');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'school_student_number_unique'), 'student IDs remain unique within a school after grade changes');

select ok(not exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'school_memberships'
    and cmd in ('INSERT', 'ALL')
), 'clients cannot directly create privileged school memberships');

select ok(has_function_privilege('authenticated', 'public.school_next_student_number(uuid,text)', 'execute'), 'authorized school staff can allocate student IDs through the guarded function');
select ok(has_function_privilege('authenticated', 'public.school_deactivate_student_membership(uuid,text,text)', 'execute'), 'authorized school staff can deactivate student enrollment through the guarded function');

select ok(exists (
  select 1 from pg_trigger
  where tgname = 'school_sync_parent_access_after_student_exit'
    and tgrelid = 'public.school_memberships'::regclass
    and not tgisinternal
), 'student transfer or graduation updates linked parent access');

select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'school_memberships'
    and policyname = 'school_memberships_read'
    and coalesce(qual, '') like '%school_can_view_membership%'
), 'membership reads use non-recursive scoped access checks');

select ok(exists (
  select 1 from pg_trigger
  where tgname = 'school_record_membership_change'
    and tgrelid = 'public.school_memberships'::regclass
    and not tgisinternal
), 'student enrollment and grade changes are recorded in school history');

select ok(exists (
  select 1 from pg_trigger
  where tgname = 'school_parent_student_link_validate'
    and tgrelid = 'public.school_parent_student_links'::regclass
    and not tgisinternal
), 'parent links are validated against same-school parent and student memberships');

select ok(exists (
  select 1 from pg_trigger
  where tgname = 'school_teacher_assignment_validate'
    and tgrelid = 'public.school_teacher_assignments'::regclass
    and not tgisinternal
), 'teacher assignments are validated against active same-school teacher memberships');

select ok(has_function_privilege('authenticated', 'public.school_can_view_profile(uuid)', 'execute'), 'profile scope helper is callable by authenticated users');
select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'profiles'
    and policyname = 'school_members_can_view_scoped_profiles'
    and coalesce(qual, '') like '%school_can_view_profile%'
), 'school profile reads use the scoped profile helper');

select ok(to_regclass('public.school_subjects') is not null, 'school subject catalog exists for manager-managed structure');

select * from finish();
rollback;
