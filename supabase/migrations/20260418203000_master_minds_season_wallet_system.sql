-- Master Minds season wallet system:
-- - total_xp (lifetime wallet, never reset)
-- - season_xp (season leaderboard score)
-- - season lifecycle + rewards + history + titles

alter table public.profiles
  add column if not exists total_xp integer not null default 0,
  add column if not exists season_xp integer not null default 0;

update public.profiles
set total_xp = greatest(coalesce(total_xp, 0), coalesce(xp, 0)),
    season_xp = coalesce(season_xp, coalesce(xp, 0));

create index if not exists idx_profiles_total_xp_desc on public.profiles (total_xp desc);
create index if not exists idx_profiles_season_xp_desc on public.profiles (season_xp desc);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  season_code text not null unique,
  season_number integer not null unique,
  status text not null default 'active' check (status in ('active', 'locked', 'closed')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  closed_at timestamptz
);

create index if not exists idx_seasons_status on public.seasons (status, season_number desc);

create table if not exists public.season_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season text not null,
  rank_position integer,
  xp_earned integer not null default 0,
  title_awarded text,
  created_at timestamptz not null default now(),
  unique(user_id, season)
);

create index if not exists idx_season_results_user_created on public.season_results (user_id, created_at desc);
create index if not exists idx_season_results_season_rank on public.season_results (season, rank_position);

create table if not exists public.user_titles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title_name text not null,
  season text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, title_name, season)
);

create index if not exists idx_user_titles_user on public.user_titles (user_id, created_at desc);
create unique index if not exists idx_user_titles_single_active on public.user_titles(user_id) where is_active = true;

alter table public.seasons enable row level security;
alter table public.season_results enable row level security;
alter table public.user_titles enable row level security;

drop policy if exists "seasons_public_read" on public.seasons;
create policy "seasons_public_read"
  on public.seasons
  for select
  using (true);

drop policy if exists "season_results_public_read" on public.season_results;
create policy "season_results_public_read"
  on public.season_results
  for select
  using (true);

drop policy if exists "user_titles_public_read" on public.user_titles;
create policy "user_titles_public_read"
  on public.user_titles
  for select
  using (true);

drop policy if exists "season_results_service_insert" on public.season_results;
create policy "season_results_service_insert"
  on public.season_results
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists "user_titles_service_write" on public.user_titles;
create policy "user_titles_service_write"
  on public.user_titles
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "seasons_service_write" on public.seasons;
create policy "seasons_service_write"
  on public.seasons
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.get_active_season_code()
returns text
language sql
security definer
set search_path = public
as $$
  select season_code
  from public.seasons
  where status = 'active'
  order by season_number desc
  limit 1;
$$;

create or replace function public.ensure_active_season()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing text;
  v_next_number integer;
  v_next_code text;
begin
  select season_code into v_existing
  from public.seasons
  where status = 'active'
  order by season_number desc
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  select coalesce(max(season_number), 0) + 1 into v_next_number from public.seasons;
  v_next_code := format('W%s', v_next_number);

  insert into public.seasons (season_code, season_number, status, starts_at)
  values (v_next_code, v_next_number, 'active', now());

  return v_next_code;
end;
$$;

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
begin
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

create or replace function public.finalize_current_season(
  p_reason text default 'Season complete'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active public.seasons%rowtype;
  v_next_number integer;
  v_next_code text;
  v_rows integer := 0;
begin
  select * into v_active
  from public.seasons
  where status = 'active'
  order by season_number desc
  limit 1;

  if v_active.id is null then
    perform public.ensure_active_season();
    select * into v_active
    from public.seasons
    where status = 'active'
    order by season_number desc
    limit 1;
  end if;

  update public.seasons
  set status = 'locked',
      locked_at = now(),
      ends_at = coalesce(ends_at, now())
  where id = v_active.id;

  with ranked as (
    select
      p.id as user_id,
      p.season_xp,
      row_number() over (order by p.season_xp desc, p.total_xp desc, p.created_at asc) as rank_position
    from public.profiles p
    where p.role = 'student'
      and coalesce(p.season_xp, 0) > 0
  )
  insert into public.season_results (user_id, season, rank_position, xp_earned, title_awarded)
  select
    r.user_id,
    v_active.season_code,
    r.rank_position,
    r.season_xp,
    case
      when r.rank_position = 1 then format('%s Champion', v_active.season_code)
      when r.rank_position = 2 then format('%s Elite', v_active.season_code)
      when r.rank_position = 3 then format('%s Top 3', v_active.season_code)
      else null
    end
  from ranked r
  on conflict (user_id, season) do update
  set rank_position = excluded.rank_position,
      xp_earned = excluded.xp_earned,
      title_awarded = excluded.title_awarded;

  with winners as (
    select user_id, rank_position
    from public.season_results
    where season = v_active.season_code
      and rank_position between 1 and 3
  )
  insert into public.user_titles (user_id, title_name, season, is_active)
  select
    w.user_id,
    case
      when w.rank_position = 1 then format('%s Champion', v_active.season_code)
      when w.rank_position = 2 then format('%s Elite', v_active.season_code)
      else format('%s Top 3', v_active.season_code)
    end,
    v_active.season_code,
    true
  from winners w
  on conflict (user_id, title_name, season) do update
  set is_active = true;

  -- Ensure only one active title per user.
  with latest_active as (
    select distinct on (user_id) id, user_id
    from public.user_titles
    where is_active = true
    order by user_id, created_at desc, id desc
  )
  update public.user_titles t
  set is_active = false
  where is_active = true
    and not exists (select 1 from latest_active la where la.id = t.id);

  insert into public.profile_achievement_history (user_id, achievement_type, title, description, metadata)
  select
    sr.user_id,
    'season_podium_finish',
    coalesce(sr.title_awarded, format('%s Season Finish', sr.season)),
    format('Finished %s at #%s with %s season XP. %s', sr.season, sr.rank_position, sr.xp_earned, p_reason),
    jsonb_build_object(
      'season', sr.season,
      'position', sr.rank_position,
      'xp_earned', sr.xp_earned,
      'reason', p_reason,
      'awarded_at', now()
    )
  from public.season_results sr
  where sr.season = v_active.season_code
    and sr.rank_position between 1 and 3
  on conflict do nothing;

  update public.profiles
  set season_xp = 0
  where role = 'student';

  update public.seasons
  set status = 'closed',
      closed_at = now(),
      ends_at = coalesce(ends_at, now())
  where id = v_active.id;

  select coalesce(max(season_number), 0) + 1 into v_next_number from public.seasons;
  v_next_code := format('W%s', v_next_number);

  insert into public.seasons (season_code, season_number, status, starts_at)
  values (v_next_code, v_next_number, 'active', now())
  on conflict (season_number) do nothing;

  select count(*) into v_rows from public.season_results where season = v_active.season_code;

  return jsonb_build_object(
    'status', 'ok',
    'season_closed', v_active.season_code,
    'participants_archived', v_rows,
    'next_season', v_next_code
  );
end;
$$;

grant execute on function public.get_active_season_code() to authenticated, anon, service_role;
grant execute on function public.ensure_active_season() to service_role;
grant execute on function public.award_user_xp(uuid, integer, text) to service_role;
grant execute on function public.finalize_current_season(text) to service_role;

select public.ensure_active_season();
