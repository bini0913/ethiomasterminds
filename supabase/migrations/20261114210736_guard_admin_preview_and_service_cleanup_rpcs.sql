-- Restrict admin-only reporting RPCs to staff roles and reserve room cleanup
-- for trusted server-side execution.

create or replace function public.admin_get_current_season_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null
     or coalesce(public.get_user_role(auth.uid())::text, '') not in ('admin', 'manager', 'extreme_admin') then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'season', to_jsonb(s.*),
    'total_users', (select count(*) from public.profiles)
  )
  into v_result
  from public.season_runtime_state s
  where s.id = 1;

  return v_result;
end;
$function$;

create or replace function public.admin_get_season_rewards_preview()
returns table(id uuid, name text, xp integer)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  if auth.uid() is null
     or coalesce(public.get_user_role(auth.uid())::text, '') not in ('admin', 'manager', 'extreme_admin') then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
    select p.id, p.name, p.xp
    from public.profiles p
    order by p.xp desc
    limit 20;
end;
$function$;

revoke all on function public.cleanup_expired_multiplayer_rooms() from public, anon, authenticated;
grant execute on function public.cleanup_expired_multiplayer_rooms() to service_role;
