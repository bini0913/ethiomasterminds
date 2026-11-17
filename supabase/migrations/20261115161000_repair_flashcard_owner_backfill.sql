-- Reconcile older production flashcard schemas before tightening visibility.
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

UPDATE public.flashcards
SET user_id = btrim(created_by)::uuid
WHERE user_id IS NULL
  AND pg_input_is_valid(btrim(created_by), 'uuid');

DROP POLICY IF EXISTS "authenticated can view flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can view public or own flashcards" ON public.flashcards;
CREATE POLICY "Users can view public or own flashcards"
ON public.flashcards
FOR SELECT TO authenticated
USING (
  is_public = true
  OR user_id = auth.uid()
  OR created_by = auth.uid()::text
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'teacher')
  )
  OR public._is_extreme_admin()
);
