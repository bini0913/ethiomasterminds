begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select ok((select relrowsecurity from pg_class where oid = 'public.quizzes'::regclass), 'school quiz records have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.library_books'::regclass), 'school library records have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.school_content_review_events'::regclass), 'content review history has RLS');

select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'quizzes'
    and policyname = 'authenticated can view public/own quizzes'
    and cmd = 'SELECT' and coalesce(qual, '') like '%school_can_view_school_quiz%'
), 'quiz visibility delegates school access to the guarded visibility function');

select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'library_books'
    and policyname = 'authenticated can view approved books'
    and cmd = 'SELECT' and coalesce(qual, '') like '%school_can_view_library_book%'
), 'library visibility delegates school access to the guarded visibility function');

select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'school_content_review_events'
    and policyname = 'school_content_review_events_read'
    and cmd = 'SELECT' and coalesce(qual, '') like '%school_can_view_content_review_event%'
), 'review history visibility is school permission checked');

select ok(not exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'school_content_review_events'
    and cmd in ('INSERT','UPDATE','DELETE','ALL')
), 'clients cannot directly mutate content review history');

select ok(has_function_privilege('authenticated', 'public.school_list_pending_content_reviews(uuid)', 'EXECUTE'), 'authorized review queue RPC is executable by authenticated sessions');
select ok(has_function_privilege('authenticated', 'public.school_review_quiz(uuid,boolean,text)', 'EXECUTE'), 'quiz review RPC is executable by authenticated sessions');
select ok(has_function_privilege('authenticated', 'public.school_review_library_book(uuid,boolean,text)', 'EXECUTE'), 'library review RPC is executable by authenticated sessions');

select ok((select prosecdef from pg_proc where oid = 'public.school_review_quiz(uuid,boolean,text)'::regprocedure), 'quiz review runs as guarded security definer');
select ok((select prosecdef from pg_proc where oid = 'public.school_review_library_book(uuid,boolean,text)'::regprocedure), 'library review runs as guarded security definer');
select ok((select prosecdef from pg_proc where oid = 'public.school_can_view_content_review_event(uuid)'::regprocedure), 'review history visibility helper is security definer');

select * from finish();
rollback;
