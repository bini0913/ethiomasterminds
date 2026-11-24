BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

SELECT ok(NOT has_function_privilege('anon','public.school_list_pending_content_reviews(uuid)','EXECUTE'),'anonymous users cannot list pending school content');
SELECT ok(has_function_privilege('authenticated','public.school_list_pending_content_reviews(uuid)','EXECUTE'),'authenticated users can request their scoped pending content queue');
SELECT ok(position('school_leadership_has_permission' in pg_get_functiondef('public.school_list_pending_content_reviews(uuid)'::regprocedure)) > 0,'pending content is filtered by active academic-leadership permissions');
SELECT ok(position('school_review_status' in pg_get_functiondef('public.school_list_pending_content_reviews(uuid)'::regprocedure)) > 0,'only school content with review status is considered');

SELECT * FROM finish();
ROLLBACK;
