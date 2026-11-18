-- Master Minds virtual-only shop: server-authoritative catalog, inventory and purchases.
CREATE TABLE IF NOT EXISTS public.store_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  section text NOT NULL CHECK (section IN ('featured','avatars','clothes','cars','houses','titles','customization','effects')),
  price integer NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'coins' CHECK (currency IN ('coins','gems')),
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  preview text NOT NULL DEFAULT '✨',
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  unlock_level integer NOT NULL DEFAULT 1 CHECK (unlock_level >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Earlier economy migrations created store_items without unlock_level.
-- IF NOT EXISTS above preserves that table, so reconcile the column before
-- the catalog seed and purchase RPC use it.
ALTER TABLE public.store_items
  ADD COLUMN IF NOT EXISTS unlock_level integer NOT NULL DEFAULT 1
  CHECK (unlock_level >= 1);

CREATE TABLE IF NOT EXISTS public.user_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.store_items(id) ON DELETE CASCADE,
  equipped boolean NOT NULL DEFAULT false,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,item_id)
);
CREATE INDEX IF NOT EXISTS user_items_user_id_idx ON public.user_items(user_id);
CREATE INDEX IF NOT EXISTS store_items_active_section_idx ON public.store_items(is_active,section);

ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active store items visible to authenticated users" ON public.store_items;
CREATE POLICY "Active store items visible to authenticated users" ON public.store_items FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Users read their own store inventory" ON public.user_items;
CREATE POLICY "Users read their own store inventory" ON public.user_items FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Seed a varied virtual catalog and level-earned titles. Idempotent by item name.
INSERT INTO public.store_items (name,section,price,currency,rarity,preview,description,unlock_level)
SELECT v.name,v.section,v.price,v.currency,v.rarity,v.preview,v.description,v.unlock_level
FROM (VALUES
 ('Starlight Avatar','avatars',120,'coins','rare','🌟','A bright profile look for curious minds.',1),
 ('Scholar Owl','avatars',250,'coins','epic','🦉','A wise companion for your next learning streak.',3),
 ('Neon Fox','avatars',400,'coins','epic','🦊','A vivid fox avatar for dedicated learners.',5),
 ('Dragon Guardian','avatars',2,'gems','legendary','🐉','A legendary guardian avatar.',10),
 ('Sky Runner Outfit','clothes',180,'coins','rare','🧥','A fresh outfit for your profile.',2),
 ('Cosmic Hoodie','clothes',320,'coins','epic','🚀','Wear your curiosity with pride.',4),
 ('Lightning Trail','effects',220,'coins','rare','⚡','A bolt of energy for your profile flair.',3),
 ('Starburst Effect','effects',2,'gems','legendary','💫','A dazzling legendary profile effect.',8),
 ('Pocket Racer','cars',300,'coins','epic','🏎️','A mini ride for your collection.',5),
 ('Dream House','houses',450,'coins','epic','🏡','A cozy home for your virtual world.',6),
 ('Curious Learner','titles',0,'coins','common','🔎','Earned by reaching Level 1.',1),
 ('Rising Mind','titles',0,'coins','common','🌱','Level reward: reach Level 3 to unlock.',3),
 ('Quiz Champion','titles',0,'coins','rare','🏅','Level reward: reach Level 5 to unlock.',5),
 ('Knowledge Keeper','titles',0,'coins','epic','📚','Level reward: reach Level 10 to unlock.',10),
 ('Master Mind','titles',0,'coins','legendary','👑','Level reward: reach Level 20 to unlock.',20)
) AS v(name,section,price,currency,rarity,preview,description,unlock_level)
WHERE NOT EXISTS (SELECT 1 FROM public.store_items s WHERE s.name=v.name);

-- The original economy migration returned public.wallets. This migration
-- changes the RPC contract to jsonb, so drop the old return type first.
DROP FUNCTION IF EXISTS public.purchase_store_item(uuid, boolean);

CREATE OR REPLACE FUNCTION public.purchase_store_item(p_item_id uuid, p_auto_equip boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid := auth.uid(); v_item public.store_items%ROWTYPE; v_coins integer; v_gems integer; v_level integer; v_owned boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_item FROM public.store_items WHERE id=p_item_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Store item not available'; END IF;
  SELECT coalesce(level,1) INTO v_level FROM public.profiles WHERE id=v_uid;
  IF v_level < coalesce(v_item.unlock_level,1) THEN RAISE EXCEPTION 'Reach level % to unlock this item',v_item.unlock_level; END IF;
  IF EXISTS(SELECT 1 FROM public.user_items WHERE user_id=v_uid AND item_id=p_item_id) THEN RAISE EXCEPTION 'Item already owned'; END IF;
  PERFORM public.ensure_wallet(v_uid);
  IF v_item.currency='coins' THEN
    UPDATE public.wallets SET coins=coins-v_item.price WHERE user_id=v_uid AND coins>=v_item.price;
  ELSE
    UPDATE public.wallets SET gems=gems-v_item.price WHERE user_id=v_uid AND gems>=v_item.price;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  IF p_auto_equip THEN
    UPDATE public.user_items ui SET equipped=false FROM public.store_items si
    WHERE ui.item_id=si.id AND ui.user_id=v_uid AND si.section=v_item.section;
  END IF;
  INSERT INTO public.user_items(user_id,item_id,equipped) VALUES(v_uid,p_item_id,p_auto_equip);
  INSERT INTO public.transactions(sender_id,receiver_id,amount,type,source) VALUES(v_uid,null,v_item.price,'purchase',v_item.name);
  INSERT INTO public.economy_notifications(user_id,title,body,category) VALUES(v_uid,'Item Unlocked!',format('%s is now in your inventory.',v_item.name),'purchase');
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id=v_uid;
  RETURN v_wallet;
END; $$;

DROP FUNCTION IF EXISTS public.equip_store_item(uuid);

CREATE OR REPLACE FUNCTION public.equip_store_item(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); v_section text; v_level integer; v_unlock_level integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_items WHERE user_id=v_uid AND item_id=p_item_id) THEN RAISE EXCEPTION 'Item not owned'; END IF;
  SELECT section,unlock_level INTO v_section,v_unlock_level FROM public.store_items WHERE id=p_item_id;
  SELECT coalesce(level,1) INTO v_level FROM public.profiles WHERE id=v_uid;
  IF v_level < coalesce(v_unlock_level,1) THEN RAISE EXCEPTION 'Reach level % to equip this item',v_unlock_level; END IF;
  UPDATE public.user_items ui SET equipped=false FROM public.store_items si
  WHERE ui.item_id=si.id AND ui.user_id=v_uid AND si.section=v_section;
  UPDATE public.user_items SET equipped=true WHERE user_id=v_uid AND item_id=p_item_id;
END; $$;
REVOKE ALL ON FUNCTION public.purchase_store_item(uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.equip_store_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_store_item(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_store_item(uuid) TO authenticated;
