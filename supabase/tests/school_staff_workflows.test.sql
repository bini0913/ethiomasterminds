begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

select ok(to_regclass('public.school_staff_tasks') is not null, 'school staff task workflow exists');
select ok(to_regclass('public.school_staff_task_comments') is not null, 'task comments exist');
select ok(to_regclass('public.school_staff_evaluations') is not null, 'staff evaluations exist');
select ok(to_regclass('public.school_disciplinary_recommendations') is not null, 'disciplinary recommendations exist');
select ok(to_regclass('public.school_staff_change_requests') is not null, 'staff change requests exist');

select ok((select relrowsecurity from pg_class where oid='public.school_staff_tasks'::regclass), 'staff tasks have RLS');
select ok((select relrowsecurity from pg_class where oid='public.school_staff_task_comments'::regclass), 'task comments have RLS');
select ok((select relrowsecurity from pg_class where oid='public.school_staff_evaluations'::regclass), 'staff evaluations have RLS');
select ok((select relrowsecurity from pg_class where oid='public.school_disciplinary_recommendations'::regclass), 'disciplinary recommendations have RLS');
select ok((select relrowsecurity from pg_class where oid='public.school_staff_change_requests'::regclass), 'staff change requests have RLS');

select ok(has_function_privilege('authenticated','public.school_can_view_staff_task(uuid)','execute'), 'task visibility is checked by membership');
select ok(has_function_privilege('authenticated','public.school_can_view_staff_evaluation(uuid)','execute'), 'evaluation visibility is checked by membership');
select ok(has_function_privilege('authenticated','public.school_review_disciplinary_recommendation(uuid,boolean,text)','execute'), 'disciplinary recommendations use guarded review');
select ok(has_function_privilege('authenticated','public.school_review_staff_change_request(uuid,boolean,text)','execute'), 'staff change requests use Super Admin review');

select ok(exists (select 1 from pg_trigger where tgname='school_staff_task_validate' and tgrelid='public.school_staff_tasks'::regclass and not tgisinternal), 'task assignment and completion transitions are guarded');
select ok(exists (select 1 from pg_trigger where tgname='school_staff_evaluation_validate' and tgrelid='public.school_staff_evaluations'::regclass and not tgisinternal), 'evaluation roles and target types are guarded');
select ok(exists (select 1 from pg_trigger where tgname='school_disciplinary_validate' and tgrelid='public.school_disciplinary_recommendations'::regclass and not tgisinternal), 'disciplinary recommendations are role-scoped');
select ok(exists (select 1 from pg_trigger where tgname='school_staff_change_request_validate' and tgrelid='public.school_staff_change_requests'::regclass and not tgisinternal), 'staff change requests cannot change roles directly');

select ok(not has_table_privilege('authenticated','public.school_staff_tasks','DELETE'), 'staff tasks cannot be deleted by clients');
select ok(not has_table_privilege('authenticated','public.school_staff_evaluations','UPDATE'), 'staff evaluations are immutable');
select ok(not has_table_privilege('authenticated','public.school_disciplinary_recommendations','UPDATE'), 'disciplinary decisions require the review function');
select ok(not has_table_privilege('authenticated','public.school_staff_change_requests','UPDATE'), 'staff change decisions require Super Admin review');

select * from finish();
rollback;
