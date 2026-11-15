begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select ok(to_regclass('public.school_homework_assignments') is not null, 'school homework assignments exist');
select ok(to_regclass('public.school_homework_submissions') is not null, 'student homework submissions exist');
select ok((select relrowsecurity from pg_class where oid='public.school_homework_assignments'::regclass), 'homework assignments have RLS');
select ok((select relrowsecurity from pg_class where oid='public.school_homework_submissions'::regclass), 'homework submissions have RLS');

select ok(has_function_privilege('authenticated','public.school_can_view_homework(uuid)','execute'), 'homework visibility is scoped to school relationships');
select ok(has_function_privilege('authenticated','public.school_submit_homework(uuid)','execute'), 'teachers submit homework through a guarded RPC');
select ok(has_function_privilege('authenticated','public.school_review_homework(uuid,boolean,text)','execute'), 'School Admin reviews homework through a guarded RPC');

select ok(exists (select 1 from pg_trigger where tgname='school_homework_assignment_validate' and tgrelid='public.school_homework_assignments'::regclass and not tgisinternal), 'teacher homework creation and review transitions are guarded');
select ok(exists (select 1 from pg_trigger where tgname='school_homework_submission_validate' and tgrelid='public.school_homework_submissions'::regclass and not tgisinternal), 'student submission and teacher grading are guarded');

select ok(not has_table_privilege('authenticated','public.school_homework_assignments','DELETE'), 'homework records cannot be deleted by clients');
select ok(not has_table_privilege('authenticated','public.school_homework_submissions','DELETE'), 'student submissions cannot be deleted by clients');

select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_homework_assignments' and policyname='school_homework_read'), 'only approved homework is visible to students and parents');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_homework_submissions' and policyname='school_homework_submissions_read'), 'parents and assigned teachers can view relevant submissions');

select ok(has_function_privilege('authenticated','public.school_is_admin(uuid)','execute'), 'homework review uses the School Admin role rather than Manager oversight');
select ok(not has_table_privilege('authenticated','public.school_homework_assignments','UPDATE'), 'homework status changes use guarded transitions');

select * from finish();
rollback;
