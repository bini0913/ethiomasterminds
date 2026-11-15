begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='quizzes' and column_name='school_id'), 'quizzes support school scoping');
select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='quizzes' and column_name='school_review_status'), 'school quizzes have a review state');
select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='library_books' and column_name='school_id'), 'library books support school scoping');
select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='book_uploads' and column_name='school_id'), 'book upload moderation is school scoped');
select ok(to_regclass('public.school_content_review_events') is not null, 'school content review audit exists');

select ok(has_function_privilege('authenticated', 'public.school_submit_quiz(uuid)', 'execute'), 'assigned teachers can submit quizzes for review');
select ok(has_function_privilege('authenticated', 'public.school_review_quiz(uuid,boolean,text)', 'execute'), 'School Admin can approve or reject quizzes');
select ok(has_function_privilege('authenticated', 'public.school_submit_library_book(uuid,uuid)', 'execute'), 'assigned teachers can submit library resources');
select ok(has_function_privilege('authenticated', 'public.school_review_library_book(uuid,boolean,text)', 'execute'), 'School Admin can approve or reject library resources');

select ok(exists (select 1 from pg_trigger where tgname='school_quiz_validate' and tgrelid='public.quizzes'::regclass and not tgisinternal), 'school quiz edits are guarded');
select ok(exists (select 1 from pg_trigger where tgname='school_quiz_question_validate' and tgrelid='public.questions'::regclass and not tgisinternal), 'questions are locked after quiz submission');
select ok(exists (select 1 from pg_trigger where tgname='school_library_book_validate' and tgrelid='public.library_books'::regclass and not tgisinternal), 'school library content submission is guarded');
select ok(exists (select 1 from pg_trigger where tgname='school_book_upload_validate' and tgrelid='public.book_uploads'::regclass and not tgisinternal), 'book moderation metadata is guarded');

select ok(has_function_privilege('authenticated', 'public.school_can_view_school_quiz(uuid)', 'execute'), 'school quiz visibility is scoped by school and approval');
select ok(has_function_privilege('authenticated', 'public.school_can_view_library_book(uuid)', 'execute'), 'library visibility is scoped by school and approval');
select ok(not has_table_privilege('authenticated', 'public.school_content_review_events', 'INSERT'), 'review audit records cannot be forged by clients');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='quizzes' and policyname='authenticated can view public/own quizzes'), 'quiz visibility policy distinguishes individual and school content');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='library_books' and policyname='authenticated can view approved books'), 'library visibility policy distinguishes individual and school resources');

select * from finish();
rollback;
