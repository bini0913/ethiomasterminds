begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select ok(
  to_regprocedure('public.school_division_director_create_sections(uuid,uuid,text,text[])') is not null,
  'division director section creation RPC exists'
);

select ok(
  (select prosecdef from pg_proc where oid='public.school_division_director_create_sections(uuid,uuid,text,text[])'::regprocedure),
  'section creation runs with controlled definer privileges'
);

select ok(
  (select coalesce(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
   from pg_proc
   where oid='public.school_division_director_create_sections(uuid,uuid,text,text[])'::regprocedure),
  'section creation pins an empty search path'
);

select ok(
  has_function_privilege('authenticated','public.school_division_director_create_sections(uuid,uuid,text,text[])','EXECUTE'),
  'authenticated sessions can call the guarded section creation RPC'
);

select ok(
  not has_function_privilege('anon','public.school_division_director_create_sections(uuid,uuid,text,text[])','EXECUTE'),
  'anonymous sessions cannot call the section creation RPC'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='school_sections'
      and cmd='INSERT'
      and policyname='school_sections_manager_insert'
  ),
  'the old manager direct-insert policy is removed'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='school_sections'
      and indexdef ilike '%(school_id, academic_year_id, grade_label, section_name)%'
  ),
  'section uniqueness is enforced per school, academic year and grade'
);

select * from finish();
rollback;
