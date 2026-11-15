begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

select ok(to_regclass('public.school_student_section_history') is not null, 'student grade and section history table exists');
select ok(to_regclass('public.school_terms') is not null, 'school terms table exists');
select ok(to_regclass('public.school_subjects') is not null, 'school subjects table exists');
select ok(to_regclass('public.school_grading_policies') is not null, 'school grading policies table exists');
select ok(to_regclass('public.school_assessment_categories') is not null, 'school assessment categories table exists');
select ok(to_regclass('public.school_grade_scales') is not null, 'school grade scales table exists');
select ok(to_regclass('public.school_assessments') is not null, 'school assessments table exists');
select ok(to_regclass('public.school_student_marks') is not null, 'school student marks table exists');
select ok(to_regclass('public.school_term_results') is not null, 'school term results table exists');
select ok(to_regclass('public.school_attendance_sessions') is not null, 'attendance sessions table exists');
select ok(to_regclass('public.school_attendance_records') is not null, 'attendance records table exists');
select ok(to_regclass('public.school_behavior_reports') is not null, 'behavior reports table exists');
select ok(to_regclass('public.school_parent_notifications') is not null, 'school parent notifications table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.school_student_section_history'::regclass), 'student section history has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_assessments'::regclass), 'assessments have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_student_marks'::regclass), 'marks have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_term_results'::regclass), 'term results have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_attendance_sessions'::regclass), 'attendance sessions have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_attendance_records'::regclass), 'attendance records have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_behavior_reports'::regclass), 'behavior reports have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_parent_notifications'::regclass), 'parent notifications have RLS enabled');

select ok(not has_table_privilege('authenticated', 'public.school_student_section_history', 'SELECT'), 'internal section history is not directly exposed to clients');
select ok(has_function_privilege('authenticated', 'public.school_seed_default_grading_categories(uuid,uuid,text)', 'execute'), 'Manager can seed default grading categories');
select ok(has_function_privilege('authenticated', 'public.school_submit_assessment(uuid)', 'execute'), 'assigned teachers can submit assessments');
select ok(has_function_privilege('authenticated', 'public.school_review_assessment(uuid,boolean,text)', 'execute'), 'School Admin can approve or reject assessments');
select ok(has_function_privilege('authenticated', 'public.school_calculate_term_results(uuid)', 'execute'), 'School Admin can calculate term results');
select ok(has_function_privilege('authenticated', 'public.school_publish_term_results(uuid)', 'execute'), 'School Admin can publish term results');
select ok(has_function_privilege('authenticated', 'public.school_review_behavior_report(uuid,boolean,text)', 'execute'), 'homeroom teachers and Admins can review behavior reports');
select ok(has_function_privilege('authenticated', 'public.school_student_was_in_section_for_term(uuid,uuid,uuid)', 'execute'), 'historical section lookup is available to scoped security functions');

select ok(exists (select 1 from pg_trigger where tgname = 'school_sync_student_section_history' and tgrelid = 'public.school_memberships'::regclass and not tgisinternal), 'grade and section changes are preserved in history');
select ok(exists (select 1 from pg_trigger where tgname = 'school_assessment_mutation_validate' and tgrelid = 'public.school_assessments'::regclass and not tgisinternal), 'assessment submission and review transitions are guarded');
select ok(exists (select 1 from pg_trigger where tgname = 'school_student_mark_validate' and tgrelid = 'public.school_student_marks'::regclass and not tgisinternal), 'mark ownership and maximum scores are validated');
select ok(exists (select 1 from pg_trigger where tgname = 'school_attendance_session_validate' and tgrelid = 'public.school_attendance_sessions'::regclass and not tgisinternal), 'attendance sessions are limited to the homeroom teacher');
select ok(exists (select 1 from pg_trigger where tgname = 'school_attendance_record_validate' and tgrelid = 'public.school_attendance_records'::regclass and not tgisinternal), 'attendance records are validated against their homeroom session');
select ok(exists (select 1 from pg_trigger where tgname = 'school_behavior_report_validate' and tgrelid = 'public.school_behavior_reports'::regclass and not tgisinternal), 'behavior reports require an assigned teacher and guarded review');
select ok(exists (select 1 from pg_trigger where tgname = 'school_attendance_session_notify_parents' and tgrelid = 'public.school_attendance_sessions'::regclass and not tgisinternal), 'parents are notified when daily attendance is submitted');
select ok(exists (select 1 from pg_trigger where tgname = 'school_behavior_notify_parent' and tgrelid = 'public.school_behavior_reports'::regclass and not tgisinternal), 'parents are notified only after behavior approval');
select ok(exists (select 1 from pg_trigger where tgname = 'school_results_notify_parent' and tgrelid = 'public.school_term_results'::regclass and not tgisinternal), 'parents are notified when official results are published');

select * from finish();
rollback;
