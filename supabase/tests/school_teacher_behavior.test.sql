begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

select ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.school_behavior_reports'::regclass
      AND conname = 'school_behavior_reports_report_type_check'
      AND pg_get_constraintdef(oid) LIKE '%academic_integrity%'
  ),
  'behavior report constraint accepts academic integrity reports'
);

select ok(
  pg_get_functiondef('public.school_can_submit_behavior_report(uuid)'::regprocedure)
    LIKE '%assignment.assignment_kind IN (''subject'', ''homeroom'')%',
  'subject and homeroom teachers can submit reports for assigned sections'
);

select ok(
  has_function_privilege('authenticated', 'public.school_review_behavior_report(uuid,boolean,text)', 'EXECUTE'),
  'authenticated homeroom teachers can use guarded behavior review'
);

select ok(
  to_regprocedure('public.school_review_behavior_report(uuid,boolean,text)') is not null,
  'guarded behavior review workflow exists'
);

select * from finish();
rollback;
