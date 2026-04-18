-- Shop + Exchange full economy upgrade
-- Adds flexible XP<->Coins exchange limits, expands shop sections, and seeds lifestyle items.

alter table public.wallets
  add column if not exists daily_xp_exchange_used integer not null default 0,
  add column if not exists daily_coins_to_xp_used integer not null default 0,
  add column if not exists exchange_limit_reset_date date not null default current_date;

-- Expand section options to match shop design.
alter table public.store_items drop constraint if exists store_items_section_check;
alter table public.store_items
  add constraint store_items_section_check
  check (section in ('featured', 'avatars', 'clothes', 'cars', 'houses', 'titles', 'customization', 'effects'));

create or replace function public.ensure_wallet(p_user_id uuid)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets;
  v_profile_xp integer;
begin
  select xp into v_profile_xp from public.profiles where id = p_user_id;

  insert into public.wallets(user_id, coins, gems, xp)
  values (p_user_id, 100, 10, coalesce(v_profile_xp, 0))
  on conflict (user_id) do update
  set xp = coalesce(public.wallets.xp, excluded.xp);

  update public.wallets
  set daily_xp_exchange_used = case
      when exchange_limit_reset_date < current_date then 0
      else daily_xp_exchange_used
    end,
    daily_coins_to_xp_used = case
      when exchange_limit_reset_date < current_date then 0
      else daily_coins_to_xp_used
    end,
    exchange_limit_reset_date = case
      when exchange_limit_reset_date < current_date then current_date
      else exchange_limit_reset_date
    end
  where user_id = p_user_id;

  select * into v_wallet
  from public.wallets
  where user_id = p_user_id;

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
  v_wallet public.wallets;
  v_reward integer;
  v_daily_limit integer := 5000;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_xp is null or p_xp < 100 then
    raise exception 'Minimum exchange is 100 XP';
  end if;

  if mod(p_xp, 10) <> 0 then
    raise exception 'XP exchange amount must be divisible by 10';
  end if;

  perform public.ensure_wallet(v_uid);

  update public.wallets
  set daily_xp_exchange_used = 0,
      daily_coins_to_xp_used = 0,
      exchange_limit_reset_date = current_date
  where user_id = v_uid
    and exchange_limit_reset_date < current_date;

  select * into v_wallet
  from public.wallets
  where user_id = v_uid
  for update;

  if coalesce(v_wallet.xp, 0) < p_xp then
    raise exception 'Insufficient XP for conversion';
  end if;

  if v_wallet.daily_xp_exchange_used + p_xp > v_daily_limit then
    raise exception 'Daily XP exchange limit reached (% XP max)', v_daily_limit;
  end if;

  v_reward := floor(p_xp / 10.0);

  update public.profiles
  set xp = greatest(xp - p_xp, 0)
  where id = v_uid;

  update public.wallets
  set xp = greatest(xp - p_xp, 0),
      coins = coins + v_reward,
      daily_xp_exchange_used = daily_xp_exchange_used + p_xp,
      exchange_limit_reset_date = current_date
  where user_id = v_uid;

  insert into public.transactions(sender_id, receiver_id, amount, type, source)
  values (v_uid, v_uid, v_reward, 'convert', format('xp_to_coins:%s', p_xp));

  insert into public.economy_notifications(user_id, title, body, category)
  values (v_uid, 'XP Converted', format('Converted %s XP into %s coins.', p_xp, v_reward), 'reward');

  select * into v_wallet from public.wallets where user_id = v_uid;
  return v_wallet;
end;
$$;

create or replace function public.convert_coins_to_xp(p_coins integer)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet public.wallets;
  v_xp_reward integer;
  v_daily_limit integer := 400;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_coins is null or p_coins < 10 then
    raise exception 'Minimum exchange is 10 coins';
  end if;

  perform public.ensure_wallet(v_uid);

  update public.wallets
  set daily_xp_exchange_used = 0,
      daily_coins_to_xp_used = 0,
      exchange_limit_reset_date = current_date
  where user_id = v_uid
    and exchange_limit_reset_date < current_date;

  select * into v_wallet
  from public.wallets
  where user_id = v_uid
  for update;

  if v_wallet.coins < p_coins then
    raise exception 'Insufficient coins';
  end if;

  if v_wallet.daily_coins_to_xp_used + p_coins > v_daily_limit then
    raise exception 'Daily coins-to-XP limit reached (% coins max)', v_daily_limit;
  end if;

  v_xp_reward := p_coins * 10;

  update public.profiles
  set xp = coalesce(xp, 0) + v_xp_reward
  where id = v_uid;

  update public.wallets
  set coins = coins - p_coins,
      xp = xp + v_xp_reward,
      daily_coins_to_xp_used = daily_coins_to_xp_used + p_coins,
      exchange_limit_reset_date = current_date
  where user_id = v_uid;

  insert into public.transactions(sender_id, receiver_id, amount, type, source)
  values (v_uid, v_uid, p_coins, 'convert', format('coins_to_xp:%s', v_xp_reward));

  insert into public.economy_notifications(user_id, title, body, category)
  values (v_uid, 'Coins Converted', format('Converted %s coins into %s XP.', p_coins, v_xp_reward), 'reward');

  select * into v_wallet from public.wallets where user_id = v_uid;
  return v_wallet;
end;
$$;

-- Add requested identity items across all sections.
insert into public.store_items (name, description, section, rarity, currency, price, preview)
values
  ('Champion Face', 'Confident champion face style.', 'avatars', 'rare', 'coins', 180, '😎'),
  ('Quantum Hair', 'Futuristic glowing hair.', 'avatars', 'epic', 'coins', 340, '💇'),
  ('Elite Glasses', 'Accessory for strategic thinkers.', 'avatars', 'rare', 'coins', 210, '🕶️'),
  ('Scholar Shirt', 'Premium shirt for class leaders.', 'clothes', 'common', 'coins', 140, '👕'),
  ('Focus Pants', 'Comfort-fit competitive pants.', 'clothes', 'common', 'coins', 120, '👖'),
  ('Velocity Shoes', 'Speed shoes for tournaments.', 'clothes', 'rare', 'coins', 190, '👟'),
  ('Mind Racer', 'Lifestyle electric car skin.', 'cars', 'epic', 'coins', 1200, '🏎️'),
  ('Brainstorm Villa', 'Showcase house for top students.', 'houses', 'legendary', 'gems', 25, '🏠'),
  ('Genius', 'Title for exceptional learners.', 'titles', 'epic', 'coins', 500, '🧠'),
  ('Champion', 'Title for arena winners.', 'titles', 'epic', 'coins', 550, '🏆'),
  ('Master Mind', 'Ultimate title for elite strategists.', 'titles', 'legendary', 'gems', 18, '👑'),
  ('Neon Featured Pack', 'Rotating featured collectible.', 'featured', 'legendary', 'gems', 22, '🌟')
on conflict do nothing;

grant execute on function public.convert_coins_to_xp(integer) to authenticated;
