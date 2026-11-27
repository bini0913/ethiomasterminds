-- Make the existing academic/library realtime subscriptions effective.
-- The questions table is deliberately excluded because it contains answer-key data;
-- students retrieve safe question payloads through the protected RPC instead.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'library_books',
    'book_uploads',
    'book_permissions',
    'library_bookmarks',
    'highlights',
    'ai_generated_questions',
    'reading_progress',
    'curriculum_textbook_catalog',
    'entrance_exam_papers',
    'quizzes',
    'flashcards',
    'user_flashcard_progress',
    'academic_book_analyses',
    'study_plans'
  ]
  loop
    if to_regclass(format('public.%I', target_table)) is not null
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = target_table
      )
    then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end $$;
