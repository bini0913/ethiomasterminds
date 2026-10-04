-- Restore the production store on the canonical avatar_items/user_inventory schema.
-- The production database does not contain the newer store_items/user_items model.

create unique index if not exists user_inventory_user_item_unique
  on public.user_inventory(user_id, item_id);

create or replace function public.purchase_store_item(
  p_item_id uuid,
  p_auto_equip boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.avatar_items%rowtype;
  v_wallet public.user_currency%rowtype;
  v_cost integer;
  v_currency text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_item
  from public.avatar_items
  where id = p_item_id
  for update;

  if not found then raise exception 'Store item not found'; end if;

  if exists (
    select 1 from public.user_inventory
    where user_id = v_uid and item_id = p_item_id
  ) then
    raise exception 'Item already owned';
  end if;

  insert into public.user_currency(user_id, coins, gems)
  values (v_uid, 100, 10)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.user_currency
  where user_id = v_uid
  for update;

  if coalesce(v_item.price_gems, 0) > 0 then
    v_cost := v_item.price_gems;
    v_currency := 'gems';
    if v_wallet.gems < v_cost then raise exception 'Insufficient gems'; end if;
    update public.user_currency set gems = gems - v_cost, updated_at = now() where user_id = v_uid;
  else
    v_cost := greatest(coalesce(v_item.price_coins, 0), 0);
    v_currency := 'coins';
    if v_wallet.coins < v_cost then raise exception 'Insufficient coins'; end if;
    update public.user_currency set coins = coins - v_cost, updated_at = now() where user_id = v_uid;
  end if;

  insert into public.user_inventory(user_id, item_id, equipped)
  values (v_uid, p_item_id, false)
  on conflict (user_id, item_id) do nothing;

  if p_auto_equip then
    update public.user_inventory ui
    set equipped = false
    from public.avatar_items ai
    where ui.user_id = v_uid
      and ui.equipped = true
      and ai.id = ui.item_id
      and ai.category = v_item.category;

    update public.user_inventory
    set equipped = true
    where user_id = v_uid and item_id = p_item_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'currency', v_currency,
    'cost', v_cost,
    'coins', (select coins from public.user_currency where user_id = v_uid),
    'gems', (select gems from public.user_currency where user_id = v_uid)
  );
end;
$$;

create or replace function public.equip_store_item(p_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_category text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select ai.category into v_category
  from public.avatar_items ai
  join public.user_inventory ui on ui.item_id = ai.id and ui.user_id = v_uid
  where ai.id = p_item_id;

  if v_category is null then raise exception 'Item is not owned'; end if;

  update public.user_inventory ui
  set equipped = false
  from public.avatar_items ai
  where ui.user_id = v_uid
    and ui.equipped = true
    and ai.id = ui.item_id
    and ai.category = v_category;

  update public.user_inventory
  set equipped = true
  where user_id = v_uid and item_id = p_item_id;

  return true;
end;
$$;

revoke all on function public.purchase_store_item(uuid, boolean) from public, anon;
revoke all on function public.equip_store_item(uuid) from public, anon;
grant execute on function public.purchase_store_item(uuid, boolean) to authenticated;
grant execute on function public.equip_store_item(uuid) to authenticated;

insert into public.avatar_items (category,name,description,preview,price_coins,price_gems,rarity)
select x.category,x.name,x.description,x.preview,x.coins,x.gems,x.rarity
from (values
  ('clothing','Smart Uniform','A polished scholar uniform.','🎓',50,0,'common'),
  ('clothing','Lab Coat','For curious minds and science sessions.','🥼',150,0,'rare'),
  ('clothing','Royal Scholar Robe','A legendary academic look.','👑',0,25,'legendary'),
  ('clothing','Midnight Hoodie','Comfortable focus mode.','🧥',220,0,'rare'),
  ('accessories','Smart Glasses','Sharper style for sharper thinking.','👓',75,0,'common'),
  ('accessories','Champion Crown','Wear your wins.','👑',0,50,'legendary'),
  ('accessories','Lightning Headset','For high-energy study sessions.','🎧',300,0,'epic'),
  ('accessories','Scholar Backpack','Carry your knowledge everywhere.','🎒',180,0,'rare'),
  ('backgrounds','Grand Library','A timeless place to learn.','📚',200,0,'rare'),
  ('backgrounds','Space Station','Study beyond the stars.','🚀',0,30,'epic'),
  ('backgrounds','Aurora Lab','A futuristic learning atmosphere.','🌌',450,0,'epic'),
  ('effects','Sparkle Effect','A subtle celebration effect.','✨',0,15,'rare'),
  ('effects','Master Glow','A legendary profile aura.','🌟',0,40,'legendary'),
  ('effects','XP Burst','Show your progress with energy.','⚡',350,0,'epic')
) as x(category,name,description,preview,coins,gems,rarity)
where not exists (
  select 1 from public.avatar_items ai where ai.name = x.name
);

