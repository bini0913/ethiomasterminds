-- Avatar system upgrade: database-driven avatar records + XP unlock validation

CREATE TABLE IF NOT EXISTS public.avatars (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  skin_tone TEXT NOT NULL DEFAULT '#D4A574',
  hair_style TEXT NOT NULL DEFAULT 'short',
  hair_color TEXT NOT NULL DEFAULT '#2B1D0E',
  eye_type TEXT NOT NULL DEFAULT 'friendly',
  mouth_type TEXT NOT NULL DEFAULT 'smile',
  accessories TEXT NOT NULL DEFAULT 'none',
  outfit TEXT NOT NULL DEFAULT 'basic-tee',
  background TEXT NOT NULL DEFAULT 'classroom',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own avatar" ON public.avatars;
CREATE POLICY "Users can read own avatar"
ON public.avatars FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own avatar" ON public.avatars;
CREATE POLICY "Users can upsert own avatar"
ON public.avatars FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.avatar_items
  ADD COLUMN IF NOT EXISTS asset_url TEXT,
  ADD COLUMN IF NOT EXISTS required_xp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rarity_level TEXT NOT NULL DEFAULT 'common';

CREATE TABLE IF NOT EXISTS public.user_unlocked_items (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.avatar_items(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

ALTER TABLE public.user_unlocked_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own unlocked items" ON public.user_unlocked_items;
CREATE POLICY "Users can view own unlocked items"
ON public.user_unlocked_items FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Server unlock inserts only" ON public.user_unlocked_items;
CREATE POLICY "Server unlock inserts only"
ON public.user_unlocked_items FOR INSERT
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.unlock_avatar_item(p_item_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp INTEGER;
  v_required_xp INTEGER;
BEGIN
  SELECT xp INTO v_xp FROM public.profiles WHERE id = auth.uid();
  SELECT required_xp INTO v_required_xp FROM public.avatar_items WHERE id = p_item_id;

  IF v_required_xp IS NULL THEN
    RAISE EXCEPTION 'Avatar item not found';
  END IF;

  IF COALESCE(v_xp, 0) < v_required_xp THEN
    RAISE EXCEPTION 'Insufficient XP to unlock item';
  END IF;

  INSERT INTO public.user_unlocked_items(user_id, item_id)
  VALUES (auth.uid(), p_item_id)
  ON CONFLICT (user_id, item_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_avatar_item(UUID) TO authenticated;

INSERT INTO public.avatar_items (name, category, preview, description, asset_url, required_xp, rarity_level)
VALUES
  ('Basic Tee', 'clothes', '👕', 'Level 1 basic shirt', 'basic-tee', 0, 'common'),
  ('Hoodie', 'clothes', '🧥', 'Level 5 hoodie', 'hoodie', 500, 'rare'),
  ('Premium Jacket', 'clothes', '🧥', 'Level 10 premium jacket', 'premium-jacket', 1000, 'epic'),
  ('Golden Hoodie', 'clothes', '✨', 'Level 20 golden hoodie', 'golden-hoodie', 2000, 'legendary'),
  ('Mastery Cape', 'clothes', '🦸', 'Level 50 education cape', 'education-cape', 5000, 'legendary'),
  ('Backpack', 'accessories', '🎒', 'Level 5 backpack', 'backpack', 500, 'rare'),
  ('Headphones', 'accessories', '🎧', 'Level 5 headphones', 'headphones', 500, 'rare'),
  ('Smart Glasses', 'glasses', '👓', 'Level 10 smart glasses', 'smart', 1000, 'epic'),
  ('Study Aura', 'aura', '✨', 'Level 20 study aura', 'study', 2000, 'legendary'),
  ('Mastery Badge', 'aura', '🏅', 'Level 50 mastery badge', 'mastery-badge', 5000, 'legendary')
ON CONFLICT DO NOTHING;
