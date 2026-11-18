-- Make student economy records read-only to browser/mobile clients.
-- Rewards, purchases, mission claims, and collectible ownership must be written
-- only by trusted server-side functions or audited administrative operations.

-- Remove permissive owner-write policies that allowed users to mint or
-- rewrite their own economy state.
DROP POLICY IF EXISTS "insert own rows" ON public.user_achievements;
DROP POLICY IF EXISTS "own rows only" ON public.user_achievements;
DROP POLICY IF EXISTS "insert own rows" ON public.user_currency;
DROP POLICY IF EXISTS "own rows only" ON public.user_currency;
DROP POLICY IF EXISTS "insert own rows" ON public.user_inventory;
DROP POLICY IF EXISTS "own rows only" ON public.user_inventory;
DROP POLICY IF EXISTS "insert own rows" ON public.user_missions;
DROP POLICY IF EXISTS "own rows only" ON public.user_missions;

-- early_user_collection is a legacy optional table: no migration in this
-- repository creates it. Keep its hardening when it exists in a deployed
-- schema, but do not make a clean reset depend on out-of-band schema state.
DO $migration$
BEGIN
  IF to_regclass('public.early_user_collection') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "early collection own rows" ON public.early_user_collection';
  END IF;
END
$migration$;

-- RLS is not a substitute for SQL privileges. Explicitly remove all direct
-- mutation privileges, including privileges inherited through PUBLIC.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE
    public.user_currency,
    public.user_inventory,
    public.user_achievements,
    public.user_missions
  FROM PUBLIC, anon, authenticated;

DO $migration$
BEGIN
  IF to_regclass('public.early_user_collection') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.early_user_collection FROM PUBLIC, anon, authenticated';
  END IF;
END
$migration$;

-- Students can continue reading their own state.
GRANT SELECT ON TABLE
  public.user_currency,
  public.user_inventory,
  public.user_achievements,
  public.user_missions
TO authenticated;

DO $migration$
BEGIN
  IF to_regclass('public.early_user_collection') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.early_user_collection TO authenticated';
  END IF;
END
$migration$;

CREATE POLICY "students read own currency"
  ON public.user_currency FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "students read own inventory"
  ON public.user_inventory FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "students read own achievements"
  ON public.user_achievements FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "students read own missions"
  ON public.user_missions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DO $migration$
BEGIN
  IF to_regclass('public.early_user_collection') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "students read own early collection" ON public.early_user_collection';
    EXECUTE 'CREATE POLICY "students read own early collection" ON public.early_user_collection FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id)';
  END IF;
END
$migration$;

-- Legacy RPC accepted any room id and paid every participant without checking
-- the caller's authority. Multiplayer rewards are now issued by the protected
-- finalize_multiplayer_results trigger after a room is legitimately finished.
DO $migration$
BEGIN
  IF to_regprocedure('public.finalize_match(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.finalize_match(uuid) FROM PUBLIC, anon, authenticated';
  END IF;
END
$migration$;
