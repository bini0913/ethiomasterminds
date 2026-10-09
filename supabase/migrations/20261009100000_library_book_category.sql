-- Uploader-selected reading experience for Library books.
ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS book_category text NOT NULL DEFAULT 'academic';

ALTER TABLE public.library_books
  DROP CONSTRAINT IF EXISTS library_books_book_category_check;
ALTER TABLE public.library_books
  ADD CONSTRAINT library_books_book_category_check
  CHECK (book_category IN ('academic', 'general'));

COMMENT ON COLUMN public.library_books.book_category IS
  'Uploader-selected reading experience: academic (AI study panel) or general (distraction-free reader).';
