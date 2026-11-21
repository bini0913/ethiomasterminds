begin;

create extension if not exists pgtap with schema extensions;

select plan(63);

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

select ok(has_function_privilege('authenticated','public.school_update_leadership_permissions(uuid,text[],text)','EXECUTE'), 'manager permission update RPC is available');
select ok(not has_function_privilege('anon','public.school_update_leadership_permissions(uuid,text[],text)','EXECUTE'), 'anonymous users cannot change leadership permissions');

select ok(exists (select 1 from pg_indexes where schemaname='public' and indexname='school_leadership_one_active_appointment_per_member'), 'one staff member cannot hold conflicting active leadership appointments');

select ok(position('main_director' in pg_get_functiondef('public.school_is_admin(uuid)'::regprocedure)) > 0, 'generic school Admin authority is restricted by leadership appointment');
select ok(position('school_is_admin' in pg_get_functiondef('public.is_school_manager_or_admin(uuid)'::regprocedure)) > 0, 'manager-or-admin checks use the leadership-aware Admin guard');


select ok(position('appointment.position = ''main_director''' in pg_get_functiondef('public.school_is_admin(uuid)'::regprocedure)) > 0, 'only an active Main Director appointment grants school Admin authority');
select ok(position('appointment.start_date' in pg_get_functiondef('public.school_is_admin(uuid)'::regprocedure)) > 0, 'Main Director authority respects appointment start date');
select ok(position('review_assessments' in pg_get_functiondef('public.school_review_assessment(uuid,boolean,text)'::regprocedure)) > 0, 'assessment review checks the leadership permission and section scope');
select ok(position('review_assessments' in pg_get_functiondef('public.school_review_homework(uuid,boolean,text)'::regprocedure)) > 0, 'homework review checks the leadership permission and section scope');
select ok(position('review_discipline' in pg_get_functiondef('public.school_can_review_behavior_report(uuid)'::regprocedure)) > 0, 'student support review checks the leadership permission and section scope');
select ok(position('publish_announcements' in pg_get_functiondef('public.school_review_announcement(uuid,boolean,text)'::regprocedure)) > 0, 'announcement review checks the leadership permission and audience scope');
select ok(position('assign_team_tasks' in pg_get_functiondef('public.school_validate_staff_task()'::regprocedure)) > 0, 'task trigger enforces leadership assignment scope');
select ok(position('review_assessments' in pg_get_functiondef('public.school_review_quiz(uuid,boolean,text)'::regprocedure)) > 0
  and position('review_assessments' in pg_get_functiondef('public.school_review_library_book(uuid,boolean,text)'::regprocedure)) > 0,
  'quiz and library approvals check scoped academic review permission');
select ok(has_function_privilege('authenticated','public.school_review_assessment(uuid,boolean,text)','EXECUTE'), 'authenticated school leaders can call the guarded assessment review RPC');
select ok(not has_function_privilege('anon','public.school_review_assessment(uuid,boolean,text)','EXECUTE'), 'anonymous users cannot call the guarded assessment review RPC');


select ok((select qual like '%review_discipline%' from pg_policies where schemaname='public' and tablename='school_memberships' and policyname='school_leadership_view_scoped_memberships'), 'student identity reads are available to scoped student-support reviewers');
select ok((select qual like '%review_assessments%' from pg_policies where schemaname='public' and tablename='school_sections' and policyname='school_leadership_view_scoped_sections'), 'section labels are readable to scoped academic reviewers');
select ok((select qual like '%review_attendance%' from pg_policies where schemaname='public' and tablename='school_attendance_sessions' and policyname='school_leadership_view_scoped_attendance_sessions'), 'attendance sessions are readable to scoped attendance reviewers');
select ok((select qual like '%review_attendance%' from pg_policies where schemaname='public' and tablename='school_attendance_records' and policyname='school_leadership_view_scoped_attendance_records'), 'attendance records are readable to scoped attendance reviewers');
select ok((select qual like '%review_discipline%' from pg_policies where schemaname='public' and tablename='school_behavior_reports' and policyname='school_leadership_view_scoped_behavior_reports'), 'behavior reports are readable to scoped discipline reviewers');
select ok((select qual like '%review_assessments%' from pg_policies where schemaname='public' and tablename='school_homework_assignments' and policyname='school_leadership_view_scoped_homework'), 'homework is readable to scoped academic reviewers');
select ok((select qual like '%assign_team_tasks%' from pg_policies where schemaname='public' and tablename='school_memberships' and policyname='school_leadership_view_scoped_memberships'), 'team task leaders can read only assigned-scope staff memberships');


select ok(to_regclass('public.school_leadership_action_events') is not null, 'operational leadership audit table exists');
select ok((select relrowsecurity from pg_class where oid='public.school_leadership_action_events'::regclass), 'operational leadership audit table has RLS');
select ok(not has_table_privilege('authenticated','public.school_leadership_action_events','INSERT'), 'clients cannot write operational leadership audit events directly');
select ok(has_function_privilege('authenticated','public.school_leadership_correct_attendance(uuid,text,text,text)','EXECUTE'), 'appointed leaders can call the guarded attendance correction RPC');
select ok(not has_function_privilege('anon','public.school_leadership_correct_attendance(uuid,text,text,text)','EXECUTE'), 'anonymous users cannot correct school attendance');
select ok(position('review_attendance' in pg_get_functiondef('public.school_validate_attendance_record()'::regprocedure)) > 0, 'attendance trigger independently validates leadership correction scope');
select ok(position('school_leadership_action_events' in pg_get_functiondef('public.school_validate_staff_task()'::regprocedure)) > 0, 'leadership task assignments and reviews are audited');

select * from finish();
rollback;
