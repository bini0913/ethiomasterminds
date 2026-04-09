-- Harden digital library workflows: role uploads, AI cache, and required tables.

CREATE TABLE IF NOT EXISTS public.ai_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('summary', 'simple', 'questions', 'flashcards', 'concepts')),
  source_hash TEXT NOT NULL,
  source_excerpt TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_content_lookup_idx
  ON public.ai_content (user_id, book_id, action, source_hash, created_at DESC);

ALTER TABLE public.ai_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own ai content" ON public.ai_content;
CREATE POLICY "Users manage own ai content" ON public.ai_content
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Ensure legacy ai_generated_questions table is also available via a compatibility view name.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'ai_content_questions'
  ) THEN
    EXECUTE 'CREATE VIEW public.ai_content_questions AS SELECT * FROM public.ai_generated_questions';
  END IF;
END $$;
