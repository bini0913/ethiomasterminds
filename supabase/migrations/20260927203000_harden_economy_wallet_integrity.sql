-- Harden economy ownership boundaries.
-- Wallet balances and inventory must only change through trusted SECURITY DEFINER RPCs.

create or replace function public.ensure_wallet(p_user_id uuid)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'You can only initialize your own wallet';
  end if;

  insert into public.wallets(user_id, coins, gems)
  values (p_user_id, 100, 10)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.wallets
  where user_id = p_user_id;

  return v_wallet;
end;
$$;

-- Remove client-side balance mutation. Rewards/purchases/transfers use server RPCs.
drop policy if exists "wallet_owner_update" on public.wallets;
drop policy if exists "wallet_owner_insert" on public.wallets;

-- Remove client-side inventory mutation. Purchase/equip RPCs remain executable.
drop policy if exists "user_items_owner_insert" on public.user_items;
drop policy if exists "user_items_owner_update" on public.user_items;

-- Notifications are server-created. Students may only mark their own notifications read.
create or replace function public.mark_economy_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  update public.economy_notifications
     set is_read = true
   where id = p_notification_id
     and user_id = uid;
end;
$$;

drop policy if exists "economy_notifications_owner_update" on public.economy_notifications;

revoke all on function public.ensure_wallet(uuid) from public;
grant execute on function public.ensure_wallet(uuid) to authenticated;

revoke all on function public.mark_economy_notification_read(uuid) from public;
grant execute on function public.mark_economy_notification_read(uuid) to authenticated;
