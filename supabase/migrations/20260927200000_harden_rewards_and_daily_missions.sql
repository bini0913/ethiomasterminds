-- Harden daily mission claiming into one authenticated, atomic transaction.
create or replace function public.claim_daily_mission(p_mission_id uuid)
returns table (
  success boolean,
  xp_awarded integer,
  coins_awarded integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mission public.user_missions%rowtype;
  reward_xp integer := 0;
  reward_coins integer := 0;
  new_xp integer;
  new_level integer;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select um.*
    into mission
    from public.user_missions um
   where um.id = p_mission_id
     and um.user_id = uid
     and um.completed = true
     and um.claimed = false
   for update;

  if not found then
    raise exception 'Mission not found, incomplete, or already claimed';
  end if;

  select coalesce(dm.reward_xp, 0), coalesce(dm.reward_coins, 0)
    into reward_xp, reward_coins
    from public.daily_missions dm
   where dm.id = mission.mission_id;

  if reward_xp < 0 or reward_coins < 0 then
    raise exception 'Invalid mission reward';
  end if;

  update public.user_missions
     set claimed = true
   where id = mission.id;

  if reward_xp > 0 then
    update public.profiles
       set xp = coalesce(xp, 0) + reward_xp,
           level = greatest(
             coalesce(level, 1),
             floor((coalesce(xp, 0) + reward_xp) / 100.0)::integer + 1
           )
     where id = uid
     returning xp, level into new_xp, new_level;
  else
    select coalesce(xp, 0), coalesce(level, 1)
      into new_xp, new_level
      from public.profiles
     where id = uid;
  end if;

  if reward_coins > 0 then
    update public.user_currency
       set coins = coalesce(coins, 0) + reward_coins
     where user_id = uid;
  end if;

  return query select true, reward_xp, reward_coins;
end;
$$;

revoke all on function public.claim_daily_mission(uuid) from public;
grant execute on function public.claim_daily_mission(uuid) to authenticated;
