begin;

create extension if not exists pgtap with schema extensions;

select plan(104);

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

select ok(position('main_director' in pg_get_functiondef('public.school_is_admin(uuid)'::regprocedure)) = 0, 'retired Main Director appointments no longer grant school Admin authority');
select ok(position('school_is_admin' in pg_get_functiondef('public.is_school_manager_or_admin(uuid)'::regprocedure)) > 0, 'manager-or-admin checks use the leadership-aware Admin guard');


select ok(position('school_role = ''admin''' in pg_get_functiondef('public.school_is_admin(uuid)'::regprocedure)) = 0, 'legacy School Admin memberships no longer grant school Admin authority');
select ok(position('main_director' in pg_get_functiondef('public.school_is_admin(uuid)'::regprocedure)) = 0, 'legacy leadership designations are excluded from school Admin authorization');
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


select ok(not exists (select 1 from pg_trigger where tgrelid='public.school_leadership_appointments'::regclass and tgname='school_require_full_main_director_permissions' and not tgisinternal), 'retired Main Director permission trigger is removed');
select ok(to_regprocedure('public.school_require_full_main_director_permissions()') is null, 'retired Main Director permission function is removed');
select ok(position('Legacy Main Director appointments are retired' in pg_get_functiondef('public.school_update_leadership_permissions(uuid,text[],text)'::regprocedure)) > 0, 'historical Main Director appointments cannot be modified');


select ok(position('Trusted account provisioning service required' in pg_get_functiondef('public.school_attach_account(uuid,uuid,uuid,text,text,text,integer,uuid,bigint,uuid[],uuid[],jsonb)'::regprocedure)) > 0, 'school account creation remains restricted to the trusted provisioning service');
select ok(not exists (select 1 from public.school_memberships where school_role='admin' and status='active'), 'legacy School Admin memberships cannot remain active');


select ok(position('An active School Manager membership in the target school is required' in pg_get_functiondef('public.school_appoint_leader(uuid,text,text,text,text[],date,date)'::regprocedure)) > 0, 'leadership appointments remain guarded by an active School Manager');
select ok(exists (select 1 from pg_trigger where tgrelid='public.school_memberships'::regclass and tgname='school_reject_retired_admin_membership' and not tgisinternal), 'new legacy School Admin memberships are blocked');


select ok(exists (select 1 from pg_indexes where schemaname='public' and indexname='school_leadership_one_active_vice_director_per_division'), 'each division can have its own active Vice Director');
select ok(exists (select 1 from pg_indexes where schemaname='public' and indexname='school_leadership_one_active_legacy_schoolwide_vice_director'), 'legacy school-wide Vice Director appointments remain unique');
select ok(position('Vice Directors must be assigned to one of the four school divisions' in pg_get_functiondef('public.school_appoint_leader(uuid,text,text,text,text[],date,date)'::regprocedure)) > 0, 'new Vice Director appointments require a division');
select ok(position('vice_director' in pg_get_functiondef('public.school_leadership_has_permission(uuid,text,text,uuid,uuid)'::regprocedure)) > 0, 'Vice Director permissions are resolved by division scope');
select ok(position('division_appointment.position' in pg_get_functiondef('public.school_can_view_leadership_appointment(uuid)'::regprocedure)) > 0, 'Division Directors can read their own division leadership appointments');
select ok(position('appointment.position IN (''vice_director'', ''team_leader'')' in pg_get_functiondef('public.school_can_view_leadership_appointment(uuid)'::regprocedure)) > 0, 'Division leadership reads do not expose other divisions');
select ok(exists (select 1 from pg_constraint where conrelid='public.school_leadership_appointments'::regclass and conname='school_leadership_appointments_position_division_scope_check'), 'leadership positions enforce division assignment rules');

select ok(position('subordinate_appointment.position' in pg_get_functiondef('public.school_leadership_has_permission(uuid,text,text,uuid,uuid)'::regprocedure)) > 0, 'Division Directors can read only their appointed Vice Director and Team Leader memberships');


select ok((select position('academic_director' in pg_get_constraintdef(oid)) > 0 from pg_constraint where conrelid='public.school_leadership_appointments'::regclass and conname='school_leadership_appointments_position_check'), 'leadership position constraint includes Academic Director');
select ok((select position('academic_director' in pg_get_constraintdef(oid)) > 0 from pg_constraint where conrelid='public.school_leadership_appointments'::regclass and conname='school_leadership_appointments_position_division_scope_check'), 'division-scope constraint allows school-wide Academic Director');
select ok(position('academic_director' in pg_get_functiondef('public.school_appoint_leader(uuid,text,text,text,text[],date,date)'::regprocedure)) > 0, 'School Manager appointment RPC supports Academic Director');
select ok(position('Academic Director permissions are limited to school-wide academic oversight' in pg_get_functiondef('public.school_appoint_leader(uuid,text,text,text,text[],date,date)'::regprocedure)) > 0, 'Academic Director appointment RPC restricts permissions to academic oversight');
select ok(position('WHEN appointment.position = ''academic_director''' in pg_get_functiondef('public.school_leadership_has_permission(uuid,text,text,uuid,uuid)'::regprocedure)) > 0, 'Academic Director permissions cover configured grades across all divisions');
select ok(position('academic_appointment.position = ''academic_director''' in pg_get_functiondef('public.school_can_view_leadership_appointment(uuid)'::regprocedure)) > 0, 'Academic Director can read the four division leadership appointments');
select ok(exists (select 1 from pg_indexes where schemaname='public' and indexname='school_leadership_one_active_singleton_position'), 'only one active Academic Director can be appointed per school');
select ok(has_function_privilege('authenticated','public.school_appoint_leader(uuid,text,text,text,text[],date,date)','EXECUTE') and not has_function_privilege('anon','public.school_appoint_leader(uuid,text,text,text,text[],date,date)','EXECUTE'), 'Academic Director appointment remains manager-only and authenticated');

select ok(position('Academic Director permissions are limited to school-wide academic oversight' in pg_get_functiondef('public.school_update_leadership_permissions(uuid,text[],text)'::regprocedure)) > 0, 'School Manager cannot grant finance or operational permissions to the Academic Director');


select ok((select position('hr_director' in pg_get_constraintdef(oid)) > 0 from pg_constraint where conrelid='public.school_leadership_appointments'::regclass and conname='school_leadership_appointments_position_check'), 'leadership position constraint includes HR Director');
select ok((select position('hr_director' in pg_get_constraintdef(oid)) > 0 from pg_constraint where conrelid='public.school_leadership_appointments'::regclass and conname='school_leadership_appointments_position_division_scope_check'), 'division-scope constraint allows school-wide HR Director');
select ok(position('hr_director' in pg_get_functiondef('public.school_appoint_leader(uuid,text,text,text,text[],date,date)'::regprocedure)) > 0, 'School Manager appointment RPC supports HR Director');
select ok(position('active Finance membership' in pg_get_functiondef('public.school_appoint_leader(uuid,text,text,text,text[],date,date)'::regprocedure)) > 0, 'HR Director appointment requires an active Finance membership');
select ok(position('HR Director permissions are limited to school HR and finance operations' in pg_get_functiondef('public.school_appoint_leader(uuid,text,text,text,text[],date,date)'::regprocedure)) > 0, 'HR Director appointment permissions are restricted to HR and finance');
select ok(position('WHEN appointment.position = ''hr_director''' in pg_get_functiondef('public.school_leadership_has_permission(uuid,text,text,uuid,uuid)'::regprocedure)) > 0, 'HR Director permissions are school-wide and finance-membership scoped');
select ok(position('view_staff' in pg_get_functiondef('public.school_can_view_profile(uuid)'::regprocedure)) > 0, 'staff profiles are visible to appointed leaders with staff-view permission');
select ok(position('view_staff_evaluations' in pg_get_functiondef('public.school_can_view_staff_evaluation(uuid)'::regprocedure)) > 0, 'staff evaluations require the dedicated HR review permission');
select ok(position('HR Director permissions are limited to school HR and finance operations' in pg_get_functiondef('public.school_update_leadership_permissions(uuid,text[],text)'::regprocedure)) > 0, 'School Manager cannot grant unrelated permissions to the HR Director');
select ok(exists (select 1 from pg_indexes where schemaname='public' and indexname='school_leadership_one_active_singleton_position'), 'only one active HR Director can be appointed per school');

select ok(position('Staff evaluation access is reserved for the HR Director' in pg_get_functiondef('public.school_appoint_leader(uuid,text,text,text,text[],date,date)'::regprocedure)) > 0, 'other leadership appointments cannot receive HR-only evaluation access');
select ok(position('Staff evaluation access is reserved for the HR Director' in pg_get_functiondef('public.school_update_leadership_permissions(uuid,text[],text)'::regprocedure)) > 0, 'School Manager cannot grant HR-only evaluation access to another leadership position');

select ok(position('target.school_role IN (''admin'', ''teacher'', ''finance'')' in pg_get_functiondef('public.school_can_view_profile(uuid)'::regprocedure)) > 0, 'HR staff profile visibility excludes student and parent profiles');


select ok(
  position('school_leadership_has_permission(target.school_id, ''view_students''' in pg_get_functiondef('public.school_can_view_profile(uuid)'::regprocedure)) > 0,
  'appointed division leaders can view student profiles only when the mapped student scope is permitted'
);
select ok(
  coalesce((
    select position('view_academics' in pg_get_expr(polqual, polrelid)) > 0
    from pg_policy
    where polname = 'school_leadership_view_scoped_memberships'
      and polrelid = 'public.school_memberships'::regclass
  ), false),
  'academic oversight permission grants scoped student membership visibility'
);
select ok(
  coalesce((
    select position('view_academics' in pg_get_expr(polqual, polrelid)) > 0
    from pg_policy
    where polname = 'school_leadership_view_scoped_sections'
      and polrelid = 'public.school_sections'::regclass
  ), false),
  'academic oversight permission grants scoped section labels'
);
select ok(
  coalesce((
    select position('review_results' in pg_get_expr(polqual, polrelid)) > 0
    from pg_policy
    where polname = 'school_leadership_view_scoped_assessments'
      and polrelid = 'public.school_assessments'::regclass
  ), false),
  'result reviewers can read scoped assessment metadata for marks and reports'
);

select * from finish();
rollback;
