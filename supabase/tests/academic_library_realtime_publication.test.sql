begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='library_books'), 'library book changes are published');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='book_uploads'), 'book moderation changes are published');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='book_permissions'), 'assigned book permission changes are published');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='library_bookmarks'), 'bookmark changes are published');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='highlights'), 'reader highlight changes are published');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ai_generated_questions'), 'saved book questions are published');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='reading_progress'), 'reading progress changes are published');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='curriculum_textbook_catalog'), 'textbook catalog changes are published');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='entrance_exam_papers'), 'entrance archive changes are published');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='quizzes'), 'quiz metadata changes are published');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='flashcards'), 'saved flashcards are published');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_flashcard_progress'), 'flashcard review progress is published');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='academic_book_analyses'), 'book analysis changes are published');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='study_plans'), 'study plan changes are published');

select * from finish();
rollback;
