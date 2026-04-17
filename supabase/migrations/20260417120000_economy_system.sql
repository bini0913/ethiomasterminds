-- Master Minds economy foundation
create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins integer not null default 0 check (coins >= 0),
  gems integer not null default 0 check (gems >= 0),
  daily_streak integer not null default 0 check (daily_streak >= 0),
  last_daily_claim_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete set null,
  receiver_id uuid references auth.users(id) on delete set null,
  amount integer not null default 0 check (amount >= 0),
  type text not null check (type in ('earn', 'spend', 'transfer', 'bonus', 'convert', 'purchase', 'gift')),
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.store_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  section text not null check (section in ('avatars', 'customization', 'titles', 'effects')),
  rarity text not null default 'common' check (rarity in ('common', 'rare', 'epic', 'legendary')),
  currency text not null check (currency in ('coins', 'gems')),
  price integer not null check (price >= 0),
  preview text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.store_items(id) on delete cascade,
  equipped boolean not null default false,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table if not exists public.economy_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null check (category in ('transfer', 'purchase', 'bonus', 'reward')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.xp_coin_exchange_tiers (
  xp_cost integer primary key,
  coin_reward integer not null check (coin_reward > 0)
);

insert into public.xp_coin_exchange_tiers (xp_cost, coin_reward)
values (100, 10), (500, 60), (1000, 150)
on conflict (xp_cost) do update set coin_reward = excluded.coin_reward;

insert into public.store_items (name, description, section, rarity, currency, price, preview)
values
  ('Rookie Avatar', 'Starter avatar for rising learners.', 'avatars', 'common', 'coins', 120, '🧑‍🎓'),
  ('Neon Genius Avatar', 'Animated neon look for top players.', 'avatars', 'epic', 'gems', 12, '🤖'),
  ('Scholar Jacket', 'Classic study-mode outfit.', 'customization', 'rare', 'coins', 220, '🧥'),
  ('Dark Theme Pack', 'Midnight UI style and gradients.', 'customization', 'rare', 'coins', 260, '🌌'),
  ('Rookie', 'Starter title for new challengers.', 'titles', 'common', 'coins', 80, '🏷️'),
  ('Genius', 'Shows mastery in weekly competitions.', 'titles', 'epic', 'coins', 500, '🧠'),
  ('Master', 'Elite rank title for focused students.', 'titles', 'epic', 'gems', 9, '👑'),
  ('Legend', 'Top-tier prestige badge title.', 'titles', 'legendary', 'gems', 16, '💎'),
  ('Glow Aura', 'Profile glow animation.', 'effects', 'rare', 'coins', 300, '✨'),
  ('Animated Border', 'Special animated profile border.', 'effects', 'legendary', 'gems', 14, '🌀')
on conflict do nothing;

create index if not exists idx_transactions_sender_type_created on public.transactions(sender_id, type, created_at desc);
create index if not exists idx_transactions_receiver_created on public.transactions(receiver_id, created_at desc);
create index if not exists idx_store_items_section_active on public.store_items(section, is_active);
create index if not exists idx_economy_notifications_user_created on public.economy_notifications(user_id, created_at desc);

create or replace function public.touch_wallet_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wallets_updated_at on public.wallets;
create trigger trg_wallets_updated_at
before update on public.wallets
for each row
execute function public.touch_wallet_updated_at();

create or replace function public.ensure_wallet(p_user_id uuid)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets;
begin
  insert into public.wallets(user_id, coins, gems)
  values (p_user_id, 100, 10)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.wallets
  where user_id = p_user_id;

  return v_wallet;
end;
$$;

create or replace function public.claim_daily_reward()
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet public.wallets;
  v_streak integer;
  v_reward integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  perform public.ensure_wallet(v_uid);

  select * into v_wallet from public.wallets where user_id = v_uid for update;

  if v_wallet.last_daily_claim_date = current_date then
    raise exception 'Daily reward already claimed today';
  end if;

  if v_wallet.last_daily_claim_date = current_date - interval '1 day' then
    v_streak := v_wallet.daily_streak + 1;
  else
    v_streak := 1;
  end if;

  v_reward := least(25 + (v_streak - 1) * 10, 150);

  update public.wallets
  set coins = coins + v_reward,
      daily_streak = v_streak,
      last_daily_claim_date = current_date
  where user_id = v_uid;

  insert into public.transactions(sender_id, receiver_id, amount, type, source)
  values (null, v_uid, v_reward, 'bonus', 'daily_reward');

  insert into public.economy_notifications(user_id, title, body, category)
  values (v_uid, 'Daily Reward Claimed', format('You earned %s coins (streak: %s days).', v_reward, v_streak), 'bonus');

  select * into v_wallet from public.wallets where user_id = v_uid;
  return v_wallet;
end;
$$;

create or replace function public.convert_xp_to_coins(p_xp integer)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reward integer;
  v_wallet public.wallets;
  v_current_xp integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select coin_reward into v_reward
  from public.xp_coin_exchange_tiers
  where xp_cost = p_xp;

  if v_reward is null then
    raise exception 'Invalid exchange tier';
  end if;

  perform public.ensure_wallet(v_uid);

  select xp into v_current_xp
  from public.profiles
  where id = v_uid
  for update;

  if coalesce(v_current_xp, 0) < p_xp then
    raise exception 'Insufficient XP for conversion';
  end if;

  update public.profiles
  set xp = greatest(xp - p_xp, 0)
  where id = v_uid;

  update public.wallets
  set coins = coins + v_reward
  where user_id = v_uid;

  insert into public.transactions(sender_id, receiver_id, amount, type, source)
  values (v_uid, v_uid, v_reward, 'convert', format('xp:%s', p_xp));

  insert into public.economy_notifications(user_id, title, body, category)
  values (v_uid, 'XP Converted', format('Converted %s XP into %s coins.', p_xp, v_reward), 'reward');

  select * into v_wallet from public.wallets where user_id = v_uid;
  return v_wallet;
end;
$$;

create or replace function public.transfer_coins(p_receiver_id uuid, p_amount integer)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet public.wallets;
  v_today_total integer;
  v_is_friend boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_receiver_id = v_uid then
    raise exception 'You cannot transfer coins to yourself';
  end if;

  if p_amount < 10 then
    raise exception 'Minimum transfer amount is 10 coins';
  end if;

  select exists(
    select 1
    from public.friends f
    where (
      (f.user_id = v_uid and f.friend_id = p_receiver_id)
      or
      (f.user_id = p_receiver_id and f.friend_id = v_uid)
    )
    and f.status = 'accepted'
  ) into v_is_friend;

  if not v_is_friend then
    raise exception 'Coin transfer is allowed only between friends';
  end if;

  select coalesce(sum(amount), 0)
  into v_today_total
  from public.transactions
  where sender_id = v_uid
    and type = 'transfer'
    and created_at >= date_trunc('day', now())
    and created_at < date_trunc('day', now()) + interval '1 day';

  if v_today_total + p_amount > 500 then
    raise exception 'Daily transfer limit is 500 coins';
  end if;

  perform public.ensure_wallet(v_uid);
  perform public.ensure_wallet(p_receiver_id);

  update public.wallets
  set coins = coins - p_amount
  where user_id = v_uid
    and coins >= p_amount;

  if not found then
    raise exception 'Insufficient coin balance';
  end if;

  update public.wallets
  set coins = coins + p_amount
  where user_id = p_receiver_id;

  insert into public.transactions(sender_id, receiver_id, amount, type, source)
  values (v_uid, p_receiver_id, p_amount, 'transfer', 'friend_transfer');

  insert into public.economy_notifications(user_id, title, body, category)
  values (p_receiver_id, 'Coins Received', format('You received %s coins from a friend.', p_amount), 'transfer');

  select * into v_wallet from public.wallets where user_id = v_uid;
  return v_wallet;
end;
$$;

create or replace function public.purchase_store_item(p_item_id uuid, p_auto_equip boolean default false)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet public.wallets;
  v_item record;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_item
  from public.store_items
  where id = p_item_id and is_active = true;

  if not found then
    raise exception 'Store item not available';
  end if;

  if exists(select 1 from public.user_items where user_id = v_uid and item_id = p_item_id) then
    raise exception 'Item already owned';
  end if;

  perform public.ensure_wallet(v_uid);

  if v_item.currency = 'coins' then
    update public.wallets
    set coins = coins - v_item.price
    where user_id = v_uid and coins >= v_item.price;
  else
    update public.wallets
    set gems = gems - v_item.price
    where user_id = v_uid and gems >= v_item.price;
  end if;

  if not found then
    raise exception 'Insufficient balance';
  end if;

  if p_auto_equip then
    update public.user_items ui
    set equipped = false
    from public.store_items si
    where ui.item_id = si.id
      and ui.user_id = v_uid
      and si.section = v_item.section;
  end if;

  insert into public.user_items(user_id, item_id, equipped)
  values (v_uid, p_item_id, p_auto_equip);

  insert into public.transactions(sender_id, receiver_id, amount, type, source)
  values (v_uid, null, v_item.price, 'purchase', v_item.name);

  insert into public.economy_notifications(user_id, title, body, category)
  values (v_uid, 'Item Unlocked!', format('%s is now in your inventory.', v_item.name), 'purchase');

  select * into v_wallet from public.wallets where user_id = v_uid;
  return v_wallet;
end;
$$;

create or replace function public.equip_store_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_section text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists(select 1 from public.user_items where user_id = v_uid and item_id = p_item_id) then
    raise exception 'Item not owned';
  end if;

  select section into v_section from public.store_items where id = p_item_id;

  update public.user_items ui
  set equipped = false
  from public.store_items si
  where ui.item_id = si.id
    and ui.user_id = v_uid
    and si.section = v_section;

  update public.user_items
  set equipped = true
  where user_id = v_uid and item_id = p_item_id;
end;
$$;

alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.store_items enable row level security;
alter table public.user_items enable row level security;
alter table public.economy_notifications enable row level security;
alter table public.xp_coin_exchange_tiers enable row level security;

create policy "wallet_owner_read" on public.wallets for select using (auth.uid() = user_id);
create policy "wallet_owner_update" on public.wallets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wallet_owner_insert" on public.wallets for insert with check (auth.uid() = user_id);

create policy "transaction_participants_read"
on public.transactions for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "store_items_public_read" on public.store_items for select using (true);
create policy "user_items_owner_read" on public.user_items for select using (auth.uid() = user_id);
create policy "user_items_owner_insert" on public.user_items for insert with check (auth.uid() = user_id);
create policy "user_items_owner_update" on public.user_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "economy_notifications_owner_read" on public.economy_notifications for select using (auth.uid() = user_id);
create policy "economy_notifications_owner_update" on public.economy_notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "xp_tiers_public_read" on public.xp_coin_exchange_tiers for select using (true);

grant execute on function public.ensure_wallet(uuid) to authenticated;
grant execute on function public.claim_daily_reward() to authenticated;
grant execute on function public.convert_xp_to_coins(integer) to authenticated;
grant execute on function public.transfer_coins(uuid, integer) to authenticated;
grant execute on function public.purchase_store_item(uuid, boolean) to authenticated;
grant execute on function public.equip_store_item(uuid) to authenticated;
