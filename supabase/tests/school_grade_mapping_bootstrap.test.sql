BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(15);

SELECT ok(
  position('Choose a grade label already used by this school' in pg_get_functiondef('public.school_set_division_grade_mapping(uuid,text,text)'::regprocedure)) = 0,
  'School Managers can map grades before class sections exist'
);

SELECT ok(
  position('An active School Manager membership in this school is required' in pg_get_functiondef('public.school_set_division_grade_mapping(uuid,text,text)'::regprocedure)) > 0,
  'grade mapping remains restricted to an active School Manager'
);

SELECT ok(
  position('A grade mapping cannot be removed while class sections exist' in pg_get_functiondef('public.school_set_division_grade_mapping(uuid,text,text)'::regprocedure)) > 0,
  'a grade mapping cannot be removed while its class sections exist'
);

SELECT ok(
  position('A grade with existing class sections cannot be moved to another division' in pg_get_functiondef('public.school_set_division_grade_mapping(uuid,text,text)'::regprocedure)) > 0,
  'a grade with existing sections cannot be reassigned to another division'
);

SELECT ok(
  to_regprocedure('public.school_initialize_default_ethiopian_grade_mappings(uuid)') IS NOT NULL,
  'standard Ethiopian grade mapping initializer exists'
);

SELECT ok(
  position('An active School Manager membership in this school is required' in pg_get_functiondef('public.school_initialize_default_ethiopian_grade_mappings(uuid)'::regprocedure)) > 0,
  'standard grade mapping initializer is Manager-only'
);

SELECT ok(
  position('Nursery' in pg_get_functiondef('public.school_initialize_default_ethiopian_grade_mappings(uuid)'::regprocedure)) > 0
  AND position('KG 1' in pg_get_functiondef('public.school_initialize_default_ethiopian_grade_mappings(uuid)'::regprocedure)) > 0
  AND position('KG 2' in pg_get_functiondef('public.school_initialize_default_ethiopian_grade_mappings(uuid)'::regprocedure)) > 0,
  'KG defaults include Nursery through KG 2'
);

SELECT ok(
  position('Grade 1' in pg_get_functiondef('public.school_initialize_default_ethiopian_grade_mappings(uuid)'::regprocedure)) > 0
  AND position('Grade 6' in pg_get_functiondef('public.school_initialize_default_ethiopian_grade_mappings(uuid)'::regprocedure)) > 0,
  'Elementary defaults include Grades 1 through 6'
);

SELECT ok(
  position('Grade 7' in pg_get_functiondef('public.school_initialize_default_ethiopian_grade_mappings(uuid)'::regprocedure)) > 0
  AND position('Grade 8' in pg_get_functiondef('public.school_initialize_default_ethiopian_grade_mappings(uuid)'::regprocedure)) > 0,
  'Middle School defaults include Grades 7 and 8'
);

SELECT ok(
  position('Grade 9' in pg_get_functiondef('public.school_initialize_default_ethiopian_grade_mappings(uuid)'::regprocedure)) > 0
  AND position('Grade 12' in pg_get_functiondef('public.school_initialize_default_ethiopian_grade_mappings(uuid)'::regprocedure)) > 0,
  'High School defaults include Grades 9 through 12'
);

SELECT ok(
  position('ON CONFLICT (school_id, grade_label) DO NOTHING' in pg_get_functiondef('public.school_initialize_default_ethiopian_grade_mappings(uuid)'::regprocedure)) > 0,
  'default initializer preserves existing grade mappings'
);

SELECT ok(
  has_function_privilege('authenticated','public.school_initialize_default_ethiopian_grade_mappings(uuid)','EXECUTE'),
  'authenticated School Managers can invoke the guarded initializer'
);

SELECT ok(
  NOT has_function_privilege('anon','public.school_initialize_default_ethiopian_grade_mappings(uuid)','EXECUTE'),
  'anonymous users cannot invoke the grade mapping initializer'
);

SELECT ok(
  position('school_is_active_division_director_for_grade' in pg_get_functiondef('public.school_division_director_create_sections(uuid,uuid,text,text[])'::regprocedure)) > 0,
  'class section creation still requires the active Director for the mapped grade'
);

SELECT ok(
  position('academic_year.is_current = true' in pg_get_functiondef('public.school_division_director_create_sections(uuid,uuid,text,text[])'::regprocedure)) > 0,
  'class section creation still requires the current academic year'
);

SELECT * FROM finish();
ROLLBACK;
