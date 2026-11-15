-- Keep flashcard ownership migration safe on databases where the original
-- realtime hardening migration has already been applied.
UPDATE public.flashcards
SET user_id = btrim(created_by)::uuid
WHERE user_id IS NULL
  AND btrim(created_by) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

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
);
