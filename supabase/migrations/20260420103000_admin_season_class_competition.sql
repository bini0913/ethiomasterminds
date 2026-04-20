-- Admin control + season reset + class competition (database-driven)

-- Ensure economy fields live on profiles for direct wallet/shop reads.
alter table public.profiles
  add column if not exists total_xp integer not null default 0,
  add column if not exists season_xp integer not null default 0,
  add column if not exists coins integer not null default 0;

update public.profiles
set total_xp = greatest(coalesce(total_xp, 0), coalesce(xp, 0)),
    season_xp = greatest(coalesce(season_xp, 0), coalesce(xp, 0)),
    coins = coalesce(coins, 0);

create index if not exists idx_profiles_season_xp_live on public.profiles (season_xp desc);
create index if not exists idx_profiles_total_xp_live on public.profiles (total_xp desc);
create index if not exists idx_profiles_class_season on public.profiles (season_xp desc, id);

-- Admin XP control: add, set, remove.
create or replace function public.admin_update_user_xp(
  p_user_identifier text,
  p_xp_amount integer,
  p_action text default 'add'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_before public.profiles%rowtype;
  v_after public.profiles%rowtype;
  v_next_total integer;
  v_next_season integer;
  v_action text := lower(coalesce(p_action, 'add'));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.get_user_role(auth.uid()) not in ('admin', 'extreme_admin') then
    raise exception 'Admin access required';
  end if;

  if p_xp_amount is null then
    raise exception 'XP amount is required';
  end if;

  select p.id
  into v_user_id
  from public.profiles p
  where p.id::text = p_user_identifier
     or lower(coalesce(p.username, '')) = lower(p_user_identifier)
  order by p.created_at asc
  limit 1;

  if v_user_id is null then
    raise exception 'User not found for identifier %', p_user_identifier;
  end if;

  select * into v_before from public.profiles where id = v_user_id for update;

  if v_action = 'add' then
    v_next_total := greatest(coalesce(v_before.total_xp, 0) + greatest(p_xp_amount, 0), 0);
    v_next_season := greatest(coalesce(v_before.season_xp, 0) + greatest(p_xp_amount, 0), 0);
  elsif v_action = 'remove' then
    v_next_total := greatest(coalesce(v_before.total_xp, 0) - greatest(p_xp_amount, 0), 0);
    v_next_season := greatest(coalesce(v_before.season_xp, 0) - greatest(p_xp_amount, 0), 0);
  elsif v_action = 'set' then
    v_next_total := greatest(p_xp_amount, 0);
    v_next_season := greatest(p_xp_amount, 0);
  else
    raise exception 'Unsupported action %. Use add, remove, or set', p_action;
  end if;

  update public.profiles
  set total_xp = v_next_total,
      season_xp = v_next_season,
      xp = v_next_total,
      level = floor(v_next_total / 100) + 1,
      updated_at = now()
  where id = v_user_id
  returning * into v_after;

  return jsonb_build_object(
    'status', 'ok',
    'user_id', v_user_id,
    'action', v_action,
    'before', jsonb_build_object('total_xp', v_before.total_xp, 'season_xp', v_before.season_xp, 'level', v_before.level),
    'after', jsonb_build_object('total_xp', v_after.total_xp, 'season_xp', v_after.season_xp, 'level', v_after.level)
  );
end;
$$;

create or replace function public.admin_set_user_level(
  p_user_identifier text,
  p_level integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_before_level integer;
  v_after_level integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.get_user_role(auth.uid()) not in ('admin', 'extreme_admin') then
    raise exception 'Admin access required';
  end if;

  if p_level is null or p_level < 1 then
    raise exception 'Level must be >= 1';
  end if;

  select p.id into v_user_id
  from public.profiles p
  where p.id::text = p_user_identifier
     or lower(coalesce(p.username, '')) = lower(p_user_identifier)
  order by p.created_at asc
  limit 1;

  if v_user_id is null then
    raise exception 'User not found for identifier %', p_user_identifier;
  end if;

  select level into v_before_level from public.profiles where id = v_user_id;

  update public.profiles
  set level = p_level,
      updated_at = now()
  where id = v_user_id
  returning level into v_after_level;

  return jsonb_build_object('status', 'ok', 'user_id', v_user_id, 'before_level', v_before_level, 'after_level', v_after_level);
end;
$$;

create or replace function public.admin_reset_user_progress(
  p_user_identifier text,
  p_reset_mode text default 'season_xp'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_mode text := lower(coalesce(p_reset_mode, 'season_xp'));
  v_before public.profiles%rowtype;
  v_after public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.get_user_role(auth.uid()) not in ('admin', 'extreme_admin') then
    raise exception 'Admin access required';
  end if;

  select p.id into v_user_id
  from public.profiles p
  where p.id::text = p_user_identifier
     or lower(coalesce(p.username, '')) = lower(p_user_identifier)
  order by p.created_at asc
  limit 1;

  if v_user_id is null then
    raise exception 'User not found for identifier %', p_user_identifier;
  end if;

  select * into v_before from public.profiles where id = v_user_id for update;

  if v_mode = 'season_xp' then
    update public.profiles
    set season_xp = 0, updated_at = now()
    where id = v_user_id
    returning * into v_after;
  elsif v_mode = 'level' then
    update public.profiles
    set level = 1, updated_at = now()
    where id = v_user_id
    returning * into v_after;
  elsif v_mode = 'full' then
    update public.profiles
    set total_xp = 0,
        season_xp = 0,
        coins = 0,
        xp = 0,
        level = 1,
        updated_at = now()
    where id = v_user_id
    returning * into v_after;
  else
    raise exception 'Unsupported reset mode %. Use season_xp, level, or full', p_reset_mode;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'user_id', v_user_id,
    'mode', v_mode,
    'before', jsonb_build_object('total_xp', v_before.total_xp, 'season_xp', v_before.season_xp, 'coins', v_before.coins, 'level', v_before.level),
    'after', jsonb_build_object('total_xp', v_after.total_xp, 'season_xp', v_after.season_xp, 'coins', v_after.coins, 'level', v_after.level)
  );
end;
$$;

-- Class competition board (fair average scoring = SUM / COUNT).
create or replace function public.get_class_competition_leaderboard(p_limit integer default 20)
returns table (
  class_id uuid,
  class_name text,
  student_count bigint,
  total_class_xp bigint,
  class_score numeric
)
language sql
security definer
set search_path = public
as $$
  with class_rollup as (
    select
      c.id as class_id,
      c.name as class_name,
      count(cs.student_id) as student_count,
      coalesce(sum(coalesce(p.season_xp, coalesce(p.xp, 0))), 0)::bigint as total_class_xp
    from public.classes c
    left join public.class_students cs on cs.class_id = c.id
    left join public.profiles p on p.id = cs.student_id
    group by c.id, c.name
  )
  select
    cr.class_id,
    cr.class_name,
    cr.student_count,
    cr.total_class_xp,
    case
      when cr.student_count > 0 then round((cr.total_class_xp::numeric / cr.student_count::numeric), 2)
      else 0
    end as class_score
  from class_rollup cr
  order by class_score desc, total_class_xp desc, class_name asc
  limit greatest(coalesce(p_limit, 20), 1);
$$;

-- Admin end-season wrapper that banks season XP to coins, snapshots results/titles, resets leaderboard, starts next season.
create or replace function public.admin_end_season(
  p_conversion_rate numeric default 1,
  p_reason text default 'Season complete'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric := coalesce(p_conversion_rate, 1);
  v_active_season text;
  v_total_coins_credited numeric;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.get_user_role(auth.uid()) not in ('admin', 'extreme_admin') then
    raise exception 'Admin access required';
  end if;

  if v_rate <= 0 then
    raise exception 'Conversion rate must be > 0';
  end if;

  v_active_season := public.ensure_active_season();

  update public.profiles
  set coins = coalesce(coins, 0) + floor(coalesce(season_xp, 0) * v_rate)::integer,
      updated_at = now()
  where role = 'student';

  select coalesce(sum(floor(coalesce(season_xp, 0) * v_rate)), 0)
  into v_total_coins_credited
  from public.profiles
  where role = 'student';

  v_result := public.finalize_current_season(p_reason);

  return v_result || jsonb_build_object(
    'conversion_rate', v_rate,
    'season_closed_by', auth.uid(),
    'coins_credited_total', v_total_coins_credited,
    'season_closed_requested', v_active_season
  );
end;
$$;

grant execute on function public.admin_update_user_xp(text, integer, text) to authenticated;
grant execute on function public.admin_set_user_level(text, integer) to authenticated;
grant execute on function public.admin_reset_user_progress(text, text) to authenticated;
grant execute on function public.get_class_competition_leaderboard(integer) to authenticated, anon;
grant execute on function public.admin_end_season(numeric, text) to authenticated;
