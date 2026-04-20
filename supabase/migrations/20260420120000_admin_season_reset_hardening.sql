-- Hardening for admin season reset system: lock state, backup archive, class/user reset helpers,
-- force-start season, and XP-award lock enforcement.

create table if not exists public.season_runtime_state (
  id boolean primary key default true,
  tournaments_paused boolean not null default false,
  xp_updates_locked boolean not null default false,
  current_season text,
  last_reset_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.season_runtime_state(id, current_season)
values (true, public.get_active_season_code())
on conflict (id) do nothing;

create table if not exists public.season_reset_backups (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank_position integer,
  season_xp integer not null default 0,
  total_xp integer not null default 0,
  level integer not null default 1,
  coins_before integer not null default 0,
  coins_credited integer not null default 0,
  backed_up_at timestamptz not null default now(),
  backed_up_by uuid references auth.users(id) on delete set null,
  unique (season, user_id)
);

create index if not exists idx_season_reset_backups_season_rank on public.season_reset_backups (season, rank_position);

alter table public.season_runtime_state enable row level security;
alter table public.season_reset_backups enable row level security;

drop policy if exists "season_runtime_state_public_read" on public.season_runtime_state;
create policy "season_runtime_state_public_read"
  on public.season_runtime_state
  for select
  using (true);

drop policy if exists "season_runtime_state_service_write" on public.season_runtime_state;
create policy "season_runtime_state_service_write"
  on public.season_runtime_state
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "season_reset_backups_public_read" on public.season_reset_backups;
create policy "season_reset_backups_public_read"
  on public.season_reset_backups
  for select
  using (true);

drop policy if exists "season_reset_backups_service_write" on public.season_reset_backups;
create policy "season_reset_backups_service_write"
  on public.season_reset_backups
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.admin_reset_single_user_season(p_user_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_before integer;
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
  limit 1;

  if v_user_id is null then
    raise exception 'User not found for identifier %', p_user_identifier;
  end if;

  select coalesce(season_xp, 0) into v_before from public.profiles where id = v_user_id;

  update public.profiles
  set season_xp = 0,
      updated_at = now()
  where id = v_user_id;

  return jsonb_build_object('status', 'ok', 'user_id', v_user_id, 'season_xp_before', v_before, 'season_xp_after', 0);
end;
$$;

create or replace function public.admin_reset_class_season(p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_students integer := 0;
  v_total_xp integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.get_user_role(auth.uid()) not in ('admin', 'extreme_admin') then
    raise exception 'Admin access required';
  end if;

  with class_members as (
    select cs.student_id
    from public.class_students cs
    where cs.class_id = p_class_id
  ), aggregate_before as (
    select count(*)::int as students, coalesce(sum(coalesce(p.season_xp, 0)), 0)::int as total_xp
    from class_members cm
    join public.profiles p on p.id = cm.student_id
  )
  select students, total_xp into v_students, v_total_xp
  from aggregate_before;

  update public.profiles p
  set season_xp = 0,
      updated_at = now()
  from public.class_students cs
  where cs.class_id = p_class_id
    and cs.student_id = p.id;

  return jsonb_build_object(
    'status', 'ok',
    'class_id', p_class_id,
    'students_reset', coalesce(v_students, 0),
    'season_xp_cleared', coalesce(v_total_xp, 0)
  );
end;
$$;

create or replace function public.admin_force_start_new_season(p_reason text default 'Admin forced next season')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active public.seasons%rowtype;
  v_next_number integer;
  v_next_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.get_user_role(auth.uid()) not in ('admin', 'extreme_admin') then
    raise exception 'Admin access required';
  end if;

  perform public.ensure_active_season();

  select * into v_active
  from public.seasons
  where status = 'active'
  order by season_number desc
  limit 1;

  update public.seasons
  set status = 'closed',
      closed_at = now(),
      ends_at = coalesce(ends_at, now())
  where id = v_active.id;

  select coalesce(max(season_number), 0) + 1 into v_next_number from public.seasons;
  v_next_code := format('W%s', v_next_number);

  insert into public.seasons(season_code, season_number, status, starts_at)
  values (v_next_code, v_next_number, 'active', now())
  on conflict (season_number) do nothing;

  update public.season_runtime_state
  set current_season = v_next_code,
      updated_at = now(),
      updated_by = auth.uid()
  where id = true;

  return jsonb_build_object('status', 'ok', 'closed_season', v_active.season_code, 'next_season', v_next_code, 'reason', p_reason);
end;
$$;

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

  update public.season_runtime_state
  set tournaments_paused = true,
      xp_updates_locked = true,
      current_season = v_active_season,
      updated_at = now(),
      updated_by = auth.uid()
  where id = true;

  -- Backup exact pre-reset standings and balances.
  with ranked as (
    select
      p.id as user_id,
      row_number() over (order by p.season_xp desc, p.total_xp desc, p.created_at asc) as rank_position,
      coalesce(p.season_xp, 0) as season_xp,
      coalesce(p.total_xp, coalesce(p.xp, 0)) as total_xp,
      coalesce(p.level, 1) as level,
      coalesce(p.coins, 0) as coins_before,
      floor(coalesce(p.season_xp, 0) * v_rate)::integer as coins_credited
    from public.profiles p
    where p.role = 'student'
  )
  insert into public.season_reset_backups(
    season, user_id, rank_position, season_xp, total_xp, level, coins_before, coins_credited, backed_up_at, backed_up_by
  )
  select
    v_active_season, r.user_id, r.rank_position, r.season_xp, r.total_xp, r.level, r.coins_before, r.coins_credited, now(), auth.uid()
  from ranked r
  on conflict (season, user_id) do update
  set rank_position = excluded.rank_position,
      season_xp = excluded.season_xp,
      total_xp = excluded.total_xp,
      level = excluded.level,
      coins_before = excluded.coins_before,
      coins_credited = excluded.coins_credited,
      backed_up_at = excluded.backed_up_at,
      backed_up_by = excluded.backed_up_by;

  update public.profiles
  set coins = coalesce(coins, 0) + floor(coalesce(season_xp, 0) * v_rate)::integer,
      updated_at = now()
  where role = 'student';

  select coalesce(sum(floor(coalesce(season_xp, 0) * v_rate)), 0)
  into v_total_coins_credited
  from public.profiles
  where role = 'student';

  v_result := public.finalize_current_season(p_reason);

  update public.season_runtime_state
  set tournaments_paused = false,
      xp_updates_locked = false,
      current_season = coalesce(v_result ->> 'next_season', public.get_active_season_code()),
      last_reset_at = now(),
      updated_at = now(),
      updated_by = auth.uid()
  where id = true;

  return v_result || jsonb_build_object(
    'conversion_rate', v_rate,
    'season_closed_by', auth.uid(),
    'coins_credited_total', v_total_coins_credited,
    'season_closed_requested', v_active_season,
    'locks_applied', true,
    'backup_table', 'season_reset_backups'
  );
exception when others then
  update public.season_runtime_state
  set tournaments_paused = false,
      xp_updates_locked = false,
      updated_at = now(),
      updated_by = auth.uid()
  where id = true;
  raise;
end;
$$;

-- Apply runtime lock to normal XP gain pipeline while allowing admin reset operations.
create or replace function public.award_user_xp(
  p_user_id uuid,
  p_xp integer,
  p_source text default 'system'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta integer;
  v_total_xp integer;
  v_season_xp integer;
  v_level integer;
  v_xp_locked boolean := false;
begin
  select coalesce(xp_updates_locked, false)
  into v_xp_locked
  from public.season_runtime_state
  where id = true;

  if v_xp_locked then
    return jsonb_build_object('status', 'locked', 'message', 'XP updates temporarily paused for season reset');
  end if;

  if p_xp is null or p_xp = 0 then
    return jsonb_build_object('status', 'noop');
  end if;

  v_delta := greatest(p_xp, 0);

  perform public.ensure_active_season();

  update public.profiles
  set total_xp = greatest(coalesce(total_xp, 0) + v_delta, 0),
      season_xp = greatest(coalesce(season_xp, 0) + v_delta, 0),
      xp = greatest(coalesce(total_xp, 0) + v_delta, 0),
      level = floor(greatest(coalesce(total_xp, 0) + v_delta, 0) / 100) + 1,
      updated_at = now()
  where id = p_user_id
  returning total_xp, season_xp, level
  into v_total_xp, v_season_xp, v_level;

  if v_total_xp is null then
    raise exception 'Profile not found for %', p_user_id;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'user_id', p_user_id,
    'source', p_source,
    'xp_added', v_delta,
    'total_xp', v_total_xp,
    'season_xp', v_season_xp,
    'level', v_level
  );
end;
$$;

grant execute on function public.admin_reset_single_user_season(text) to authenticated;
grant execute on function public.admin_reset_class_season(uuid) to authenticated;
grant execute on function public.admin_force_start_new_season(text) to authenticated;
grant execute on function public.admin_end_season(numeric, text) to authenticated;
grant execute on function public.award_user_xp(uuid, integer, text) to service_role;
