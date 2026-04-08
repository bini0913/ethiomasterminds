-- Library feature: books, likes/bookmarks, and storage buckets.
CREATE TABLE IF NOT EXISTS public.library_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  pdf_path TEXT NOT NULL,
  thumbnail_path TEXT,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  uploader_role public.app_role NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.library_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, user_id)
);

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view books" ON public.library_books;
CREATE POLICY "Authenticated users can view books"
ON public.library_books
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Students and teachers can create books" ON public.library_books;
CREATE POLICY "Students and teachers can create books"
ON public.library_books
FOR INSERT
WITH CHECK (
  auth.uid() = uploader_id
  AND public.get_user_role(auth.uid()) IN ('student', 'teacher', 'admin', 'manager')
  AND uploader_role = public.get_user_role(auth.uid())
);

DROP POLICY IF EXISTS "Uploader can edit own book" ON public.library_books;
CREATE POLICY "Uploader can edit own book"
ON public.library_books
FOR UPDATE
USING (uploader_id = auth.uid())
WITH CHECK (uploader_id = auth.uid());

DROP POLICY IF EXISTS "Uploader can delete own book" ON public.library_books;
CREATE POLICY "Uploader can delete own book"
ON public.library_books
FOR DELETE
USING (uploader_id = auth.uid());

DROP POLICY IF EXISTS "Admins and managers can moderate all books" ON public.library_books;
CREATE POLICY "Admins and managers can moderate all books"
ON public.library_books
FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Authenticated users can view bookmarks" ON public.library_bookmarks;
CREATE POLICY "Authenticated users can view bookmarks"
ON public.library_bookmarks
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can create own bookmarks" ON public.library_bookmarks;
CREATE POLICY "Users can create own bookmarks"
ON public.library_bookmarks
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.library_bookmarks;
CREATE POLICY "Users can delete own bookmarks"
ON public.library_bookmarks
FOR DELETE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own bookmarks" ON public.library_bookmarks;
CREATE POLICY "Users can update own bookmarks"
ON public.library_bookmarks
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_library_books_updated_at ON public.library_books;
CREATE TRIGGER update_library_books_updated_at
  BEFORE UPDATE ON public.library_books
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('library-files', 'library-files', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('library-thumbnails', 'library-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Library files are public read" ON storage.objects;
CREATE POLICY "Library files are public read"
ON storage.objects
FOR SELECT
USING (bucket_id IN ('library-files', 'library-thumbnails'));

DROP POLICY IF EXISTS "Library users can upload files" ON storage.objects;
CREATE POLICY "Library users can upload files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id IN ('library-files', 'library-thumbnails')
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Library users can update own files" ON storage.objects;
CREATE POLICY "Library users can update own files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id IN ('library-files', 'library-thumbnails')
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id IN ('library-files', 'library-thumbnails')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Library users can delete own files" ON storage.objects;
CREATE POLICY "Library users can delete own files"
ON storage.objects
FOR DELETE
USING (
  bucket_id IN ('library-files', 'library-thumbnails')
  AND auth.uid()::text = (storage.foldername(name))[1]
);
