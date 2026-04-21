-- MASTER MINDS: full season system upgrade (history + rewards + class competition + admin previews)

alter table public.seasons
  add column if not exists name text,
  add column if not exists start_date timestamptz,
  add column if not exists end_date timestamptz;

update public.seasons
set name = coalesce(name, format('Season %s', season_number)),
    start_date = coalesce(start_date, starts_at),
    end_date = coalesce(end_date, ends_at);

create table if not exists public.user_season_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  total_xp integer not null default 0,
  rank integer,
  class_rank integer,
  created_at timestamptz not null default now(),
  unique (user_id, season_id)
);

create table if not exists public.season_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  final_rank integer,
  final_xp integer not null default 0,
  reward_coins integer not null default 0,
  title_awarded text,
  created_at timestamptz not null default now(),
  unique (user_id, season_id)
);

create table if not exists public.class_leaderboard (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  class_name text not null,
  avg_xp numeric(12,2) not null default 0,
  rank integer,
  created_at timestamptz not null default now(),
  unique (season_id, class_name)
);

create or replace view public.wallet as
select p.id as user_id, coalesce(p.coins, 0) as coins
from public.profiles p;

alter table public.user_season_stats enable row level security;
alter table public.season_history enable row level security;
alter table public.class_leaderboard enable row level security;

drop policy if exists "user_season_stats_public_read" on public.user_season_stats;
create policy "user_season_stats_public_read" on public.user_season_stats for select using (true);
drop policy if exists "user_season_stats_service_write" on public.user_season_stats;
create policy "user_season_stats_service_write" on public.user_season_stats for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "season_history_public_read" on public.season_history;
create policy "season_history_public_read" on public.season_history for select using (true);
drop policy if exists "season_history_service_write" on public.season_history;
create policy "season_history_service_write" on public.season_history for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "class_leaderboard_public_read" on public.class_leaderboard;
create policy "class_leaderboard_public_read" on public.class_leaderboard for select using (true);
drop policy if exists "class_leaderboard_service_write" on public.class_leaderboard;
create policy "class_leaderboard_service_write" on public.class_leaderboard for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create or replace function public.admin_get_current_season_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active public.seasons%rowtype;
  v_total_students integer := 0;
  v_total_season_xp bigint := 0;
  v_top_user text := null;
begin
  perform public.ensure_active_season();

  select * into v_active
  from public.seasons
  where status = 'active'
  order by season_number desc
  limit 1;

  select count(*)::integer, coalesce(sum(coalesce(p.season_xp, 0)), 0)::bigint
  into v_total_students, v_total_season_xp
  from public.profiles p
  where p.role = 'student';

  select coalesce(p.name, p.username, p.id::text)
  into v_top_user
  from public.profiles p
  where p.role = 'student'
  order by coalesce(p.season_xp, 0) desc, coalesce(p.total_xp, 0) desc, p.created_at asc
  limit 1;

  return jsonb_build_object(
    'season_id', v_active.id,
    'season_code', v_active.season_code,
    'season_name', coalesce(v_active.name, format('Season %s', v_active.season_number)),
    'start_date', coalesce(v_active.start_date, v_active.starts_at),
    'end_date', coalesce(v_active.end_date, v_active.ends_at),
    'total_users', v_total_students,
    'top_player', v_top_user,
    'total_xp', v_total_season_xp
  );
end;
$$;

create or replace function public.admin_get_season_rewards_preview(p_conversion_rate numeric default 0.1, p_limit integer default 25)
returns table (
  user_id uuid,
  name text,
  season_xp integer,
  projected_rank integer,
  projected_coins integer,
  projected_title text
)
language sql
security definer
set search_path = public
as $$
  with ranked as (
    select
      p.id as user_id,
      coalesce(p.name, p.username, p.id::text) as name,
      coalesce(p.season_xp, 0) as season_xp,
      row_number() over (order by coalesce(p.season_xp, 0) desc, coalesce(p.total_xp, 0) desc, p.created_at asc) as projected_rank
    from public.profiles p
    where p.role = 'student'
  )
  select
    r.user_id,
    r.name,
    r.season_xp,
    r.projected_rank,
    (
      floor(r.season_xp * greatest(coalesce(p_conversion_rate, 0.1), 0.01))::integer
      + case
          when r.projected_rank = 1 then 500
          when r.projected_rank = 2 then 300
          when r.projected_rank = 3 then 200
          when r.projected_rank <= 10 then 100
          else 0
        end
    )::integer as projected_coins,
    case
      when r.projected_rank = 1 then 'Champion'
      when r.projected_rank <= 3 then 'Top 3'
      when r.projected_rank <= 10 then 'Top 10'
      else null
    end as projected_title
  from ranked r
  order by r.projected_rank asc
  limit greatest(coalesce(p_limit, 25), 1);
$$;

create or replace function public.admin_end_season(
  p_conversion_rate numeric default 0.1,
  p_reason text default 'Season complete',
  p_confirm_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric := greatest(coalesce(p_conversion_rate, 0.1), 0.01);
  v_active public.seasons%rowtype;
  v_total_coins_credited bigint := 0;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.get_user_role(auth.uid()) not in ('admin', 'extreme_admin') then
    raise exception 'Admin access required';
  end if;

  if coalesce(p_confirm_text, '') <> 'CONFIRM' then
    raise exception 'Type CONFIRM to end the season';
  end if;

  perform public.ensure_active_season();

  select * into v_active
  from public.seasons
  where status = 'active'
  order by season_number desc
  limit 1;

  update public.season_runtime_state
  set tournaments_paused = true,
      xp_updates_locked = true,
      current_season = v_active.season_code,
      updated_at = now(),
      updated_by = auth.uid()
  where id = true;

  with ranked as (
    select
      p.id as user_id,
      coalesce(p.season_xp, 0) as season_xp,
      coalesce(p.total_xp, 0) as total_xp,
      coalesce(p.grade, 'Unassigned') as class_name,
      row_number() over (order by coalesce(p.season_xp, 0) desc, coalesce(p.total_xp, 0) desc, p.created_at asc) as global_rank,
      row_number() over (partition by coalesce(p.grade, 'Unassigned') order by coalesce(p.season_xp, 0) desc, coalesce(p.total_xp, 0) desc, p.created_at asc) as class_rank
    from public.profiles p
    where p.role = 'student'
  ), rewards as (
    select
      r.*,
      floor(r.season_xp * v_rate)::integer as base_coins,
      case
        when r.global_rank = 1 then 500
        when r.global_rank = 2 then 300
        when r.global_rank = 3 then 200
        when r.global_rank <= 10 then 100
        else 0
      end as bonus_coins,
      case
        when r.global_rank = 1 then 'Champion'
        when r.global_rank <= 3 then 'Top 3'
        when r.global_rank <= 10 then 'Top 10'
        else null
      end as title_awarded
    from ranked r
  )
  insert into public.user_season_stats(user_id, season_id, total_xp, rank, class_rank)
  select rw.user_id, v_active.id, rw.season_xp, rw.global_rank, rw.class_rank
  from rewards rw
  on conflict (user_id, season_id) do update
  set total_xp = excluded.total_xp, rank = excluded.rank, class_rank = excluded.class_rank;

  with rewards as (
    select
      p.id as user_id,
      coalesce(p.season_xp, 0) as season_xp,
      row_number() over (order by coalesce(p.season_xp, 0) desc, coalesce(p.total_xp, 0) desc, p.created_at asc) as global_rank
    from public.profiles p
    where p.role = 'student'
  ), payout as (
    select
      r.user_id,
      r.season_xp,
      r.global_rank,
      floor(r.season_xp * v_rate)::integer
      + case
          when r.global_rank = 1 then 500
          when r.global_rank = 2 then 300
          when r.global_rank = 3 then 200
          when r.global_rank <= 10 then 100
          else 0
        end as total_reward,
      case
        when r.global_rank = 1 then 'Champion'
        when r.global_rank <= 3 then 'Top 3'
        when r.global_rank <= 10 then 'Top 10'
        else null
      end as title_awarded
    from rewards r
  )
  insert into public.season_history(user_id, season_id, final_rank, final_xp, reward_coins, title_awarded)
  select py.user_id, v_active.id, py.global_rank, py.season_xp, py.total_reward, py.title_awarded
  from payout py
  on conflict (user_id, season_id) do update
  set final_rank = excluded.final_rank,
      final_xp = excluded.final_xp,
      reward_coins = excluded.reward_coins,
      title_awarded = excluded.title_awarded;

  with rewards as (
    select
      p.id as user_id,
      coalesce(p.season_xp, 0) as season_xp,
      row_number() over (order by coalesce(p.season_xp, 0) desc, coalesce(p.total_xp, 0) desc, p.created_at asc) as global_rank
    from public.profiles p
    where p.role = 'student'
  )
  update public.profiles p
  set coins = coalesce(p.coins, 0)
      + floor(coalesce(p.season_xp, 0) * v_rate)::integer
      + case
          when r.global_rank = 1 then 500
          when r.global_rank = 2 then 300
          when r.global_rank = 3 then 200
          when r.global_rank <= 10 then 100
          else 0
        end,
      updated_at = now()
  from rewards r
  where r.user_id = p.id;

  select coalesce(sum(reward_coins), 0)::bigint into v_total_coins_credited
  from public.season_history
  where season_id = v_active.id;

  insert into public.profile_achievement_history (user_id, achievement_type, title, description, metadata)
  select
    sh.user_id,
    case
      when sh.final_rank = 1 then 'season_champion'
      when sh.final_rank <= 3 then 'season_top_3'
      when sh.final_rank <= 10 then 'season_top_10'
      else 'season_finish'
    end,
    coalesce(sh.title_awarded, 'Season Finish'),
    format('Season %s finish: #%s with %s XP and %s reward coins.', v_active.season_number, sh.final_rank, sh.final_xp, sh.reward_coins),
    jsonb_build_object('season_id', v_active.id, 'season_code', v_active.season_code, 'rank', sh.final_rank, 'xp', sh.final_xp, 'reward_coins', sh.reward_coins)
  from public.season_history sh
  where sh.season_id = v_active.id
    and sh.final_rank <= 10
  on conflict do nothing;

  insert into public.user_titles(user_id, title_name, season, is_active)
  select sh.user_id, format('%s Champion', v_active.season_code), v_active.season_code, true
  from public.season_history sh
  where sh.season_id = v_active.id
    and sh.final_rank = 1
  on conflict (user_id, title_name, season) do update
  set is_active = true;

  with class_scores as (
    select
      coalesce(p.grade, 'Unassigned') as class_name,
      count(*) as student_count,
      coalesce(sum(coalesce(p.season_xp, 0)), 0)::numeric as total_xp,
      case when count(*) > 0 then round(coalesce(sum(coalesce(p.season_xp, 0)), 0)::numeric / count(*)::numeric, 2) else 0 end as avg_xp
    from public.profiles p
    where p.role = 'student'
    group by coalesce(p.grade, 'Unassigned')
  ), ranked_classes as (
    select cs.*, row_number() over (order by cs.avg_xp desc, cs.total_xp desc, cs.class_name asc) as rank
    from class_scores cs
  )
  insert into public.class_leaderboard(season_id, class_name, avg_xp, rank)
  select v_active.id, rc.class_name, rc.avg_xp, rc.rank
  from ranked_classes rc
  on conflict (season_id, class_name) do update
  set avg_xp = excluded.avg_xp, rank = excluded.rank;

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
    'season_closed_requested', v_active.season_code,
    'confirmation_required', true,
    'achievements_awarded_top_10', true
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

grant execute on function public.admin_end_season(numeric, text, text) to authenticated;
grant execute on function public.admin_get_current_season_stats() to authenticated;
grant execute on function public.admin_get_season_rewards_preview(numeric, integer) to authenticated;
