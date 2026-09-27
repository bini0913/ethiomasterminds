-- Harden the legacy XP RPC so students cannot award XP to arbitrary users.
create or replace function public.add_xp(p_user_id uuid, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_xp integer;
  v_new_xp integer;
  v_current_level integer;
  v_new_level integer;
  v_new_rank text;
  v_leveled_up boolean := false;
  v_coins_to_add integer := 0;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'You can only add XP to your own account';
  end if;

  if p_amount <= 0 or p_amount > 500 then
    raise exception 'Invalid XP amount';
  end if;

  select xp, level into v_current_xp, v_current_level
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  v_new_xp := coalesce(v_current_xp, 0) + p_amount;
  v_new_level := floor(v_new_xp / 100) + 1;
  v_new_rank := calculate_rank(v_new_xp);
  v_leveled_up := v_new_level > coalesce(v_current_level, 1);

  update public.profiles
     set xp = v_new_xp,
         level = v_new_level,
         rank = v_new_rank
   where id = p_user_id;

  if p_amount > 0 then
    v_coins_to_add := floor(p_amount / 100);
    if v_coins_to_add > 0 then
      insert into public.user_currency(user_id, coins)
      values (p_user_id, v_coins_to_add)
      on conflict (user_id) do update
        set coins = public.user_currency.coins + v_coins_to_add,
            updated_at = now();
    end if;
  end if;

  return jsonb_build_object(
    'previous_xp', v_current_xp,
    'new_xp', v_new_xp,
    'xp_gained', p_amount,
    'previous_level', v_current_level,
    'new_level', v_new_level,
    'leveled_up', v_leveled_up,
    'rank', v_new_rank,
    'coins_added', v_coins_to_add
  );
end;
$$;

revoke all on function public.add_xp(uuid, integer) from public;
grant execute on function public.add_xp(uuid, integer) to authenticated;
