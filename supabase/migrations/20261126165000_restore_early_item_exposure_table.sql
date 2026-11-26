-- Restore the early-learning exposure table referenced by get_early_leaderboard.
-- The frontend currently tracks exposure offline in local storage; this table is
-- internal-only until a reviewed sync path is implemented.
CREATE TABLE IF NOT EXISTS public.early_item_exposure (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.early_content_items(id) ON DELETE CASCADE,
  last_seen timestamptz NOT NULL DEFAULT now(),
  times_seen integer NOT NULL DEFAULT 1 CHECK (times_seen >= 1),
  last_correct boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, item_id)
);

ALTER TABLE public.early_item_exposure ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "early exposure own rows" ON public.early_item_exposure;
CREATE POLICY "early exposure own rows"
  ON public.early_item_exposure
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

REVOKE ALL ON public.early_item_exposure FROM PUBLIC, anon, authenticated;
