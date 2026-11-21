begin;

create extension if not exists pgtap with schema extensions;

select plan(34);

select ok(to_regclass('public.school_leadership_appointments') is not null, 'leadership appointments table exists');
select ok(to_regclass('public.school_leadership_audit_events') is not null, 'leadership audit table exists');
select ok((select relrowsecurity from pg_class where oid='public.school_leadership_appointments'::regclass), 'leadership appointments have RLS');
select ok((select relrowsecurity from pg_class where oid='public.school_leadership_audit_events'::regclass), 'leadership audit has RLS');
select ok(has_table_privilege('authenticated','public.school_leadership_appointments','SELECT'), 'authenticated users can read only rows permitted by RLS');
select ok(not has_table_privilege('authenticated','public.school_leadership_appointments','INSERT'), 'appointments cannot be inserted directly');
select ok(not has_table_privilege('authenticated','public.school_leadership_appointments','UPDATE'), 'appointments cannot be updated directly');
select ok(not has_table_privilege('authenticated','public.school_leadership_appointments','DELETE'), 'appointments cannot be deleted directly');
select ok(has_function_privilege('authenticated','public.school_appoint_leader(uuid,text,text,text,text[],date,date)','EXECUTE'), 'manager appointment RPC is available to authenticated users');
select ok(has_function_privilege('authenticated','public.school_update_leadership_appointment(uuid,text,date,text)','EXECUTE'), 'manager status RPC is available to authenticated users');
select ok(not has_function_privilege('anon','public.school_appoint_leader(uuid,text,text,text,text[],date,date)','EXECUTE'), 'anonymous users cannot appoint leaders');
select ok(not has_function_privilege('anon','public.school_update_leadership_appointment(uuid,text,date,text)','EXECUTE'), 'anonymous users cannot change appointments');
select ok(exists (select 1 from pg_indexes where schemaname='public' and indexname='school_leadership_one_active_singleton_position'), 'singleton leadership positions cannot be double-booked');
select ok(exists (select 1 from pg_trigger where tgname='school_leadership_appointment_audit' and tgrelid='public.school_leadership_appointments'::regclass and not tgisinternal), 'leadership changes are audited');

select ok(to_regclass('public.school_division_grade_mappings') is not null, 'school-specific grade division mappings exist');
select ok(to_regclass('public.school_leadership_team_members') is not null, 'team membership assignments exist');
select ok((select relrowsecurity from pg_class where oid='public.school_division_grade_mappings'::regclass), 'division mappings have RLS');
select ok((select relrowsecurity from pg_class where oid='public.school_leadership_team_members'::regclass), 'team membership assignments have RLS');
select ok(has_function_privilege('authenticated','public.school_set_division_grade_mapping(uuid,text,text)','EXECUTE'), 'manager division mapping RPC is available');
select ok(has_function_privilege('authenticated','public.school_assign_leadership_team_member(uuid,uuid,boolean)','EXECUTE'), 'manager team assignment RPC is available');
select ok(not has_function_privilege('anon','public.school_set_division_grade_mapping(uuid,text,text)','EXECUTE'), 'anonymous users cannot configure school divisions');
select ok(not has_function_privilege('anon','public.school_assign_leadership_team_member(uuid,uuid,boolean)','EXECUTE'), 'anonymous users cannot assign team members');

select ok(has_function_privilege('authenticated','public.school_leadership_has_permission(uuid,text,text,uuid,uuid)','EXECUTE'), 'leadership permission resolver is available to authenticated users');
select ok(not has_function_privilege('anon','public.school_leadership_has_permission(uuid,text,text,uuid,uuid)','EXECUTE'), 'anonymous users cannot query leadership permission resolver');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_memberships' and policyname='school_leadership_view_scoped_memberships'), 'membership reads support appointment-scoped leaders');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_sections' and policyname='school_leadership_view_scoped_sections'), 'section reads support division scope');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_teacher_assignments' and policyname='school_leadership_view_scoped_teacher_assignments'), 'teacher assignment reads support division and team scope');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_attendance_sessions' and policyname='school_leadership_view_scoped_attendance_sessions'), 'attendance session reads support leadership scope');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_attendance_records' and policyname='school_leadership_view_scoped_attendance_records'), 'attendance record reads support student and division scope');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_assessments' and policyname='school_leadership_view_scoped_assessments'), 'assessment reads support leadership scope');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_student_marks' and policyname='school_leadership_view_scoped_marks'), 'result reads support leadership scope');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_behavior_reports' and policyname='school_leadership_view_scoped_behavior_reports'), 'student support reads support leadership scope');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_homework_assignments' and policyname='school_leadership_view_scoped_homework'), 'homework reads support leadership scope');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_staff_tasks' and policyname='school_leadership_view_scoped_staff_tasks'), 'team task reads support assigned team scope');

select * from finish();
rollback;
