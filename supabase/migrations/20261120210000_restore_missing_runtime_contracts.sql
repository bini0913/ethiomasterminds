-- Restore schema contracts that exist in the deployed Master Minds database but
-- were missing from the checked-in migration chain. This is a forward repair:
-- never resurrect deleted migration versions or weaken client-side protections.

CREATE TABLE IF NOT EXISTS public.notification_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'android'
    CHECK (platform IN ('android', 'ios')),
  app_version text,
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_devices_enabled_idx
  ON public.notification_devices(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS notification_devices_user_idx
  ON public.notification_devices(user_id);

ALTER TABLE public.notification_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own notification devices" ON public.notification_devices;
CREATE POLICY "Users manage own notification devices"
  ON public.notification_devices FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
REVOKE ALL ON TABLE public.notification_devices FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.notification_devices TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_notification_device(
  p_token text,
  p_platform text DEFAULT 'android',
  p_app_version text DEFAULT NULL,
  p_enabled boolean DEFAULT true
)
RETURNS public.notification_devices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_row public.notification_devices;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_token IS NULL OR length(trim(p_token)) < 20 THEN
    RAISE EXCEPTION 'Invalid notification token';
  END IF;
  INSERT INTO public.notification_devices(
    user_id, token, platform, app_version, enabled, last_seen_at, updated_at
  )
  VALUES (
    auth.uid(), trim(p_token), coalesce(p_platform, 'android'), p_app_version,
    coalesce(p_enabled, true), now(), now()
  )
  ON CONFLICT (token) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    app_version = EXCLUDED.app_version,
    enabled = EXCLUDED.enabled,
    last_seen_at = now(),
    updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.disable_notification_device(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  UPDATE public.notification_devices
     SET enabled = false, updated_at = now()
   WHERE token = p_token AND user_id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.upsert_notification_device(text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_notification_device(text, text, text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.disable_notification_device(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.disable_notification_device(text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.early_collectibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '⭐',
  rarity text NOT NULL DEFAULT 'common',
  set_name text NOT NULL DEFAULT 'Starter Set',
  price_coins integer NOT NULL DEFAULT 0 CHECK (price_coins >= 0),
  unlock_rule text,
  model jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.early_user_collection (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collectible_id uuid NOT NULL REFERENCES public.early_collectibles(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, collectible_id)
);

ALTER TABLE public.early_collectibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.early_user_collection ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "early collectibles public read" ON public.early_collectibles;
CREATE POLICY "early collectibles public read"
  ON public.early_collectibles FOR SELECT TO authenticated
  USING (active = true);
DROP POLICY IF EXISTS "students read own early collection" ON public.early_user_collection;
CREATE POLICY "students read own early collection"
  ON public.early_user_collection FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
REVOKE ALL ON TABLE public.early_collectibles, public.early_user_collection FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.early_collectibles, public.early_user_collection TO authenticated;

CREATE OR REPLACE FUNCTION public.purchase_early_item(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  uid uuid := auth.uid();
  item public.early_collectibles%rowtype;
  wallet public.user_currency%rowtype;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT * INTO item
    FROM public.early_collectibles
   WHERE id = p_item_id AND active = true
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collectible not found';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.early_user_collection
     WHERE user_id = uid AND collectible_id = p_item_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'owned', true);
  END IF;
  SELECT * INTO wallet
    FROM public.user_currency
   WHERE user_id = uid
   FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.user_currency(user_id, coins, gems)
    VALUES (uid, 0, 0)
    RETURNING * INTO wallet;
  END IF;
  IF wallet.coins < item.price_coins THEN
    RAISE EXCEPTION 'Not enough coins';
  END IF;
  UPDATE public.user_currency
     SET coins = coins - item.price_coins, updated_at = now()
   WHERE user_id = uid;
  INSERT INTO public.early_user_collection(user_id, collectible_id)
  VALUES (uid, p_item_id);
  RETURN jsonb_build_object(
    'ok', true,
    'owned', true,
    'remaining_coins', wallet.coins - item.price_coins
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_early_profile_summary(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT jsonb_build_object(
    'xp', coalesce(p.xp, 0),
    'level', coalesce(p.level, 1),
    'season_xp', 0,
    'streak', coalesce((SELECT us.current_streak FROM public.user_streaks us WHERE us.user_id = p.id), 0),
    'stars', coalesce((SELECT count(*) FROM public.early_user_achievements ua WHERE ua.user_id = p.id AND ua.completed), 0),
    'discovered', coalesce((SELECT count(*) FROM public.early_activity_progress e WHERE e.user_id = p.id), 0),
    'collectibles', coalesce((SELECT count(*) FROM public.early_user_collection c WHERE c.user_id = p.id), 0)
  )
  FROM public.profiles p
  WHERE p.id = p_user_id AND p.id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.purchase_early_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_early_item(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_early_profile_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_early_profile_summary(uuid) TO authenticated;
