-- Atomic daily mission claiming. A mission can only be claimed once,
-- and the reward is calculated from the stored mission definition.
create or replace function public.claim_daily_mission(p_user_mission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mission public.user_missions%rowtype;
  v_reward_xp integer;
  v_reward_coins integer;
  v_new_xp integer;
  v_new_level integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select um.*, dm.reward_xp, dm.reward_coins
    into v_mission, v_reward_xp, v_reward_coins
  from public.user_missions um
  join public.daily_missions dm on dm.id = um.mission_id
  where um.id = p_user_mission_id
    and um.user_id = v_uid
  for update;

  if not found then
    raise exception 'Mission not found';
  end if;

  if v_mission.claimed then
    return jsonb_build_object(
      'success', true,
      'already_claimed', true,
      'xp_awarded', 0,
      'coins_awarded', 0
    );
  end if;

  if not v_mission.completed then
    raise exception 'Mission not completed yet';
  end if;

  update public.user_missions
     set claimed = true
   where id = p_user_mission_id
     and user_id = v_uid
     and claimed = false;

  if not found then
    raise exception 'Reward was already claimed';
  end if;

  v_reward_xp := greatest(0, coalesce(v_reward_xp,0));
  v_reward_coins := greatest(0, coalesce(v_reward_coins,0));

  if v_reward_xp > 0 then
    perform public.add_xp(v_uid, least(v_reward_xp,500));
  end if;

  if v_reward_coins > 0 then
    insert into public.user_currency(user_id,coins)
    values(v_uid,v_reward_coins)
    on conflict(user_id) do update
      set coins = public.user_currency.coins + v_reward_coins,
          updated_at = now();
  end if;

  select xp, level into v_new_xp, v_new_level
  from public.profiles
  where id = v_uid;

  return jsonb_build_object(
    'success', true,
    'already_claimed', false,
    'xp_awarded', v_reward_xp,
    'coins_awarded', v_reward_coins,
    'new_xp', coalesce(v_new_xp,0),
    'new_level', coalesce(v_new_level,1)
  );
end;
$$;

revoke execute on function public.claim_daily_mission(uuid) from public, anon;
grant execute on function public.claim_daily_mission(uuid) to authenticated;
