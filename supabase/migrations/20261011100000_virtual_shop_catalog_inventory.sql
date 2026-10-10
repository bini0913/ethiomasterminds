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

CREATE OR REPLACE FUNCTION public.purchase_store_item(p_item_id uuid, p_auto_equip boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid := auth.uid(); v_item public.store_items%ROWTYPE; v_coins integer; v_gems integer; v_level integer; v_owned boolean;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO v_item FROM public.store_items WHERE id=p_item_id AND is_active=true FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This item is no longer available'; END IF;
 SELECT level INTO v_level FROM public.profiles WHERE id=v_user;
 v_level := coalesce(v_level,1);
 IF v_level < v_item.unlock_level THEN RAISE EXCEPTION 'Reach level % to unlock this item',v_item.unlock_level; END IF;
 SELECT EXISTS(SELECT 1 FROM public.user_items WHERE user_id=v_user AND item_id=p_item_id) INTO v_owned;
 IF v_owned THEN RAISE EXCEPTION 'You already own this item'; END IF;
 INSERT INTO public.user_currency(user_id,coins,gems) VALUES(v_user,0,0) ON CONFLICT(user_id) DO NOTHING;
 SELECT coins,gems INTO v_coins,v_gems FROM public.user_currency WHERE user_id=v_user FOR UPDATE;
 IF v_item.currency='coins' AND v_coins < v_item.price THEN RAISE EXCEPTION 'Not enough coins'; END IF;
 IF v_item.currency='gems' AND v_gems < v_item.price THEN RAISE EXCEPTION 'Not enough gems'; END IF;
 IF v_item.currency='coins' THEN UPDATE public.user_currency SET coins=coins-v_item.price,updated_at=now() WHERE user_id=v_user;
 ELSE UPDATE public.user_currency SET gems=gems-v_item.price,updated_at=now() WHERE user_id=v_user; END IF;
 IF p_auto_equip THEN UPDATE public.user_items SET equipped=false WHERE user_id=v_user AND item_id IN (SELECT id FROM public.store_items WHERE section=v_item.section); END IF;
 INSERT INTO public.user_items(user_id,item_id,equipped) VALUES(v_user,p_item_id,coalesce(p_auto_equip,false));
 RETURN jsonb_build_object('success',true,'item_id',p_item_id,'coins_spent',CASE WHEN v_item.currency='coins' THEN v_item.price ELSE 0 END,'gems_spent',CASE WHEN v_item.currency='gems' THEN v_item.price ELSE 0 END);
END; $$;

CREATE OR REPLACE FUNCTION public.equip_store_item(p_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid := auth.uid(); v_item public.store_items%ROWTYPE; v_level integer;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT s.* INTO v_item FROM public.store_items s JOIN public.user_items i ON i.item_id=s.id WHERE s.id=p_item_id AND i.user_id=v_user AND s.is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'You must own this item before equipping it'; END IF;
 SELECT coalesce(level,1) INTO v_level FROM public.profiles WHERE id=v_user;
 IF coalesce(v_level,1)<v_item.unlock_level THEN RAISE EXCEPTION 'Reach level % to equip this item',v_item.unlock_level; END IF;
 UPDATE public.user_items SET equipped=false WHERE user_id=v_user AND item_id IN (SELECT id FROM public.store_items WHERE section=v_item.section);
 UPDATE public.user_items SET equipped=true WHERE user_id=v_user AND item_id=p_item_id;
 RETURN jsonb_build_object('success',true,'item_id',p_item_id);
END; $$;
REVOKE ALL ON FUNCTION public.purchase_store_item(uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.equip_store_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_store_item(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_store_item(uuid) TO authenticated;
