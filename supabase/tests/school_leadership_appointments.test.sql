begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

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

select * from finish();
rollback;
