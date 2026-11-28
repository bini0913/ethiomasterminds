begin;

create extension if not exists pgtap with schema extensions;
select plan(32);

select ok(to_regclass('public.school_curriculum_units') is not null, 'school curriculum units table exists');
select ok(to_regclass('public.school_curriculum_unit_events') is not null, 'curriculum unit audit table exists');
select ok(to_regclass('public.school_curriculum_progress') is not null, 'teacher curriculum progress table exists');
select ok(to_regclass('public.school_academic_interventions') is not null, 'academic intervention table exists');
select ok(to_regclass('public.school_academic_intervention_events') is not null, 'academic intervention audit table exists');

select ok((select relrowsecurity from pg_class where oid='public.school_curriculum_units'::regclass), 'curriculum units have RLS');
select ok((select relrowsecurity from pg_class where oid='public.school_curriculum_progress'::regclass), 'curriculum progress has RLS');
select ok((select relrowsecurity from pg_class where oid='public.school_curriculum_unit_events'::regclass), 'curriculum audit has RLS');
select ok((select relrowsecurity from pg_class where oid='public.school_academic_interventions'::regclass), 'academic interventions have RLS');
select ok((select relrowsecurity from pg_class where oid='public.school_academic_intervention_events'::regclass), 'intervention audit has RLS');

select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_curriculum_units' and policyname='school_curriculum_units_select' and cmd='SELECT'), 'curriculum units use an explicit scoped read policy');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_curriculum_progress' and policyname='school_curriculum_progress_select' and cmd='SELECT'), 'curriculum progress reads are scoped to managers and assigned teachers');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='school_academic_interventions' and policyname='school_academic_interventions_select' and cmd='SELECT' and coalesce(qual,'') like '%is_school_manager_or_admin%'), 'student intervention records are manager/admin only');

select ok(not has_table_privilege('authenticated','public.school_curriculum_units','INSERT'), 'authenticated users cannot insert curriculum units directly');
select ok(not has_table_privilege('authenticated','public.school_curriculum_units','UPDATE'), 'authenticated users cannot update curriculum units directly');
select ok(not has_table_privilege('authenticated','public.school_curriculum_units','DELETE'), 'authenticated users cannot delete curriculum units directly');
select ok(not has_table_privilege('authenticated','public.school_academic_interventions','INSERT'), 'authenticated users cannot insert intervention records directly');
select ok(not has_table_privilege('authenticated','public.school_academic_interventions','UPDATE'), 'authenticated users cannot update intervention records directly');

select ok(has_function_privilege('authenticated','public.school_manager_save_curriculum_unit(uuid,uuid,text,text,text,text,text,integer,text,text,text,text,date,date,boolean,uuid,uuid,uuid)','execute'), 'authenticated sessions can call the manager-guarded curriculum RPC');
select ok(has_function_privilege('authenticated','public.school_teacher_update_curriculum_progress(uuid,uuid,text,text)','execute'), 'authenticated sessions can call the teacher-guarded progress RPC');
select ok(has_function_privilege('authenticated','public.school_manager_save_academic_intervention(uuid,uuid,uuid,uuid,text,text,text,text,date,text,text,uuid)','execute'), 'authenticated sessions can call the manager-guarded intervention RPC');
select ok(not has_function_privilege('anon','public.school_manager_save_curriculum_unit(uuid,uuid,text,text,text,text,text,integer,text,text,text,text,date,date,boolean,uuid,uuid,uuid)','execute'), 'anonymous sessions cannot call curriculum mutation RPC');

select ok(exists (select 1 from pg_trigger where tgname='school_curriculum_unit_audit' and tgrelid='public.school_curriculum_units'::regclass and not tgisinternal), 'curriculum unit changes are audited');
select ok(exists (select 1 from pg_trigger where tgname='school_curriculum_progress_audit' and tgrelid='public.school_curriculum_progress'::regclass and not tgisinternal), 'teacher progress changes are audited');
select ok(exists (select 1 from pg_trigger where tgname='school_academic_intervention_audit' and tgrelid='public.school_academic_interventions'::regclass and not tgisinternal), 'intervention changes are audited');
select ok(exists (select 1 from pg_trigger where tgname='school_curriculum_unit_events_immutable' and tgrelid='public.school_curriculum_unit_events'::regclass and not tgisinternal), 'curriculum unit audit events are immutable');
select ok(exists (select 1 from pg_trigger where tgname='school_curriculum_progress_events_immutable' and tgrelid='public.school_curriculum_progress_events'::regclass and not tgisinternal), 'curriculum progress audit events are immutable');
select ok(exists (select 1 from pg_trigger where tgname='school_academic_intervention_events_immutable' and tgrelid='public.school_academic_intervention_events'::regclass and not tgisinternal), 'intervention audit events are immutable');

select ok(exists (select 1 from pg_constraint where conrelid='public.school_curriculum_units'::regclass and conname='school_curriculum_unit_unique'), 'curriculum unit codes are unique within grade, subject and year');
select ok(exists (select 1 from pg_constraint where conrelid='public.school_curriculum_progress'::regclass and conname='school_curriculum_progress_unique'), 'each unit has one delivery record per section');
select ok(exists (select 1 from pg_constraint where conrelid='public.school_academic_interventions'::regclass and conname='school_academic_intervention_student_check'), 'resolved interventions require an outcome');
select ok(exists (select 1 from pg_constraint where conrelid='public.school_curriculum_units'::regclass and conname='school_curriculum_unit_single_linked_source_check'), 'a curriculum unit links at most one textbook source');

select * from finish();
rollback;
