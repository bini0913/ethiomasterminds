-- Economy upgrade: exchange expansion, lucky spin, suspicious transfer flags
alter table public.wallets
add column if not exists xp integer not null default 0;

create table if not exists public.suspicious_economy_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_spin_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  spin_date date not null default current_date,
  reward_type text not null check (reward_type in ('coins', 'gems', 'item')),
  reward_amount integer not null default 0,
  reward_item_id uuid references public.store_items(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, spin_date)
);

create index if not exists idx_suspicious_economy_user_date on public.suspicious_economy_activity(user_id, created_at desc);

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
  set xp = excluded.xp;

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
  from public.wallets
  where user_id = v_uid
  for update;

  if coalesce(v_current_xp, 0) < p_xp then
    raise exception 'Insufficient XP for conversion';
  end if;

  update public.profiles set xp = greatest(xp - p_xp, 0) where id = v_uid;

  update public.wallets
  set xp = greatest(xp - p_xp, 0),
      coins = coins + v_reward
  where user_id = v_uid;

  insert into public.transactions(sender_id, receiver_id, amount, type, source)
  values (v_uid, v_uid, v_reward, 'convert', format('xp:%s', p_xp));

  insert into public.economy_notifications(user_id, title, body, category)
  values (v_uid, 'XP Converted', format('Converted %s XP into %s coins.', p_xp, v_reward), 'reward');

  select * into v_wallet from public.wallets where user_id = v_uid;
  return v_wallet;
end;
$$;

create or replace function public.convert_coins_to_gems(p_coins integer)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_gems integer;
  v_wallet public.wallets;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_coins < 100 then
    raise exception 'Minimum exchange is 100 coins';
  end if;

  v_gems := floor(p_coins::numeric / 100.0);

  if v_gems <= 0 then
    raise exception 'Not enough coins to convert';
  end if;

  perform public.ensure_wallet(v_uid);

  update public.wallets
  set coins = coins - p_coins,
      gems = gems + v_gems
  where user_id = v_uid
    and coins >= p_coins;

  if not found then
    raise exception 'Insufficient coins';
  end if;

  insert into public.transactions(sender_id, receiver_id, amount, type, source)
  values (v_uid, v_uid, p_coins, 'convert', format('coins_to_gems:%s', v_gems));

  select * into v_wallet from public.wallets where user_id = v_uid;
  return v_wallet;
end;
$$;

create or replace function public.perform_lucky_spin()
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_roll numeric;
  v_reward_type text;
  v_reward_amount integer;
  v_item_id uuid;
  v_wallet public.wallets;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if exists(select 1 from public.daily_spin_claims where user_id = v_uid and spin_date = current_date) then
    raise exception 'Lucky spin already used today';
  end if;

  perform public.ensure_wallet(v_uid);
  v_roll := random();

  if v_roll < 0.6 then
    v_reward_type := 'coins';
    v_reward_amount := (array[20, 35, 50, 80])[floor(random() * 4 + 1)];
    update public.wallets set coins = coins + v_reward_amount where user_id = v_uid;
  elsif v_roll < 0.9 then
    v_reward_type := 'gems';
    v_reward_amount := (array[1, 2, 3])[floor(random() * 3 + 1)];
    update public.wallets set gems = gems + v_reward_amount where user_id = v_uid;
  else
    v_reward_type := 'item';
    v_reward_amount := 0;
    select id into v_item_id from public.store_items where is_active = true order by random() limit 1;
    if v_item_id is not null then
      insert into public.user_items(user_id, item_id, equipped)
      values (v_uid, v_item_id, false)
      on conflict (user_id, item_id) do nothing;
    end if;
  end if;

  insert into public.daily_spin_claims(user_id, spin_date, reward_type, reward_amount, reward_item_id)
  values (v_uid, current_date, v_reward_type, v_reward_amount, v_item_id);

  insert into public.transactions(sender_id, receiver_id, amount, type, source)
  values (null, v_uid, coalesce(v_reward_amount, 0), 'bonus', format('lucky_spin:%s', v_reward_type));

  insert into public.economy_notifications(user_id, title, body, category)
  values (v_uid, 'Lucky Spin Reward',
    case
      when v_reward_type = 'item' then 'You won a store item from lucky spin!'
      when v_reward_type = 'gems' then format('You won %s gems from lucky spin!', v_reward_amount)
      else format('You won %s coins from lucky spin!', v_reward_amount)
    end,
    'bonus');

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
    where ((f.user_id = v_uid and f.friend_id = p_receiver_id) or (f.user_id = p_receiver_id and f.friend_id = v_uid))
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

  if p_amount >= 300 then
    insert into public.suspicious_economy_activity(user_id, activity_type, details)
    values (v_uid, 'large_transfer', format('Attempted transfer amount: %s', p_amount));
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

  update public.wallets set coins = coins + p_amount where user_id = p_receiver_id;

  insert into public.transactions(sender_id, receiver_id, amount, type, source)
  values (v_uid, p_receiver_id, p_amount, 'transfer', 'friend_transfer');

  insert into public.economy_notifications(user_id, title, body, category)
  values (p_receiver_id, 'Coins Received', format('You received %s coins from a friend.', p_amount), 'transfer');

  select * into v_wallet from public.wallets where user_id = v_uid;
  return v_wallet;
end;
$$;

alter table public.suspicious_economy_activity enable row level security;
alter table public.daily_spin_claims enable row level security;

create policy "suspicious_activity_owner_read" on public.suspicious_economy_activity
for select using (auth.uid() = user_id);

create policy "daily_spin_owner_read" on public.daily_spin_claims
for select using (auth.uid() = user_id);
create policy "daily_spin_owner_insert" on public.daily_spin_claims
for insert with check (auth.uid() = user_id);

grant execute on function public.convert_coins_to_gems(integer) to authenticated;
grant execute on function public.perform_lucky_spin() to authenticated;
