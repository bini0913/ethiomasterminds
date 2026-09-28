-- Final production hardening for legacy XP and admin-only season analytics.
--
-- All normal student progression now flows through activity-specific,
-- server-authoritative completion RPCs. The old generic add_xp RPC is retained
-- for trusted SECURITY DEFINER callers such as complete_study_session, but it
-- must not be directly callable from a browser session.
revoke all on function public.add_xp(uuid, integer) from public;
revoke all on function public.add_xp(uuid, integer) from anon;
revoke all on function public.add_xp(uuid, integer) from authenticated;

-- These SECURITY DEFINER functions expose aggregate season/admin data and
-- therefore must only be callable by administrative sessions.
revoke all on function public.admin_get_current_season_stats() from public;
revoke all on function public.admin_get_current_season_stats() from anon;
revoke all on function public.admin_get_current_season_stats() from authenticated;
grant execute on function public.admin_get_current_season_stats() to authenticated;

revoke all on function public.admin_get_season_rewards_preview(numeric, integer) from public;
revoke all on function public.admin_get_season_rewards_preview(numeric, integer) from anon;
revoke all on function public.admin_get_season_rewards_preview(numeric, integer) from authenticated;
grant execute on function public.admin_get_season_rewards_preview(numeric, integer) to authenticated;

-- The functions above must enforce admin/manager authorization themselves.
create or replace function public.admin_get_current_season_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state season_runtime_state%rowtype;
  v_total_users int;
  v_total_xp bigint;
  v_top_name text;
begin
  if not (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'manager')) then
    raise exception 'Permission denied';
  end if;

  select * into v_state from season_runtime_state where id = 1;
  select count(*), coalesce(sum(season_xp), 0)
    into v_total_users, v_total_xp
    from profiles
   where season_xp > 0;
  select name into v_top_name
    from profiles
   order by season_xp desc nulls last
   limit 1;

  return jsonb_build_object(
    'season_name', v_state.current_season_name,
    'season_number', v_state.season_number,
    'started_at', v_state.started_at,
    'total_users', coalesce(v_total_users, 0),
    'total_xp', coalesce(v_total_xp, 0),
    'top_player', coalesce(v_top_name, '—')
  );
end;
$$;

create or replace function public.admin_get_season_rewards_preview(
  p_conversion_rate numeric default 0.1,
  p_limit integer default 10
)
returns table(
  user_id uuid,
  name text,
  season_xp integer,
  projected_rank integer,
  projected_coins integer,
  projected_title text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'manager')) then
    raise exception 'Permission denied';
  end if;

  if p_conversion_rate is null or p_conversion_rate < 0 or p_conversion_rate > 10 then
    raise exception 'Invalid conversion rate';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid result limit';
  end if;

  return query
  select
    p.id,
    p.name,
    coalesce(p.season_xp, 0),
    row_number() over (order by p.season_xp desc nulls last)::int,
    greatest(0, floor(coalesce(p.season_xp, 0) * p_conversion_rate))::int,
    case
      when row_number() over (order by p.season_xp desc nulls last) = 1 then 'Champion'
      when row_number() over (order by p.season_xp desc nulls last) <= 3 then 'Podium'
      when row_number() over (order by p.season_xp desc nulls last) <= 10 then 'Top 10'
      else null
    end
  from profiles p
  where coalesce(p.season_xp, 0) > 0
  order by p.season_xp desc nulls last
  limit p_limit;
end;
$$;

grant execute on function public.admin_get_current_season_stats() to authenticated;
grant execute on function public.admin_get_season_rewards_preview(numeric, integer) to authenticated;
