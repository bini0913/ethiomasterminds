-- Convert all student XP into shop wallet coins, snapshot rank/XP history as profile achievements,
-- and reset leaderboard progress for a fresh season.

create table if not exists public.profile_achievement_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_type text not null,
  title text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  achieved_at timestamptz not null default now()
);

create index if not exists idx_profile_achievement_history_user_date
  on public.profile_achievement_history (user_id, achieved_at desc);

alter table public.profile_achievement_history enable row level security;

drop policy if exists "profile_achievement_history_public_read" on public.profile_achievement_history;
create policy "profile_achievement_history_public_read"
  on public.profile_achievement_history
  for select
  using (true);

drop policy if exists "profile_achievement_history_service_insert" on public.profile_achievement_history;
create policy "profile_achievement_history_service_insert"
  on public.profile_achievement_history
  for insert
  with check (auth.role() = 'service_role');

create or replace function public.reset_student_leaderboard_and_bank_xp(
  p_reason text default 'Season reset'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moved_students integer := 0;
  v_total_xp_moved integer := 0;
  v_reset_rank text;
begin
  -- Ensure wallet exists for each student and copy profile XP into wallet if missing.
  insert into public.wallets (user_id, coins, gems, xp)
  select p.id, 100, 10, coalesce(p.xp, 0)
  from public.profiles p
  where p.role = 'student'
  on conflict (user_id) do update
  set xp = coalesce(public.wallets.xp, excluded.xp);

  -- Snapshot each student's pre-reset rank/xp as a Duolingo-style profile achievement.
  insert into public.profile_achievement_history (user_id, achievement_type, title, description, metadata)
  select
    p.id,
    'leaderboard_reset_snapshot',
    'Season Reset Snapshot',
    format('Finished season at rank %s with %s XP. %s coins were credited to your shop wallet.', coalesce(nullif(p.rank, ''), 'UNRANKED'), coalesce(p.xp, 0), coalesce(p.xp, 0)),
    jsonb_build_object(
      'reason', p_reason,
      'xp_before_reset', coalesce(p.xp, 0),
      'rank_before_reset', p.rank,
      'level_before_reset', coalesce(p.level, 1),
      'coins_credited', coalesce(p.xp, 0),
      'reset_at', now()
    )
  from public.profiles p
  where p.role = 'student';

  -- Add transactional record for transparency.
  insert into public.transactions (sender_id, receiver_id, amount, type, source)
  select
    p.id,
    p.id,
    coalesce(p.xp, 0),
    'convert',
    'leaderboard_reset_xp_to_coins'
  from public.profiles p
  where p.role = 'student'
    and coalesce(p.xp, 0) > 0;

  -- Credit coins 1:1 from pre-reset XP and clear wallet XP.
  update public.wallets w
  set coins = w.coins + coalesce(p.xp, 0),
      xp = 0
  from public.profiles p
  where p.id = w.user_id
    and p.role = 'student';

  -- Hard reset leaderboard-driving profile progression.
  v_reset_rank := coalesce(public.rank_from_level(1), 'BRONZE');
  update public.profiles
  set xp = 0,
      level = 1,
      rank = v_reset_rank
  where role = 'student';

  select
    count(*),
    coalesce(sum(coalesce((metadata->>'xp_before_reset')::integer, 0)), 0)
  into v_moved_students, v_total_xp_moved
  from public.profile_achievement_history
  where achievement_type = 'leaderboard_reset_snapshot'
    and achieved_at >= now() - interval '5 minutes';

  return jsonb_build_object(
    'status', 'ok',
    'students_reset', v_moved_students,
    'total_xp_moved_to_wallet_coins', v_total_xp_moved,
    'reset_rank', v_reset_rank
  );
end;
$$;

grant execute on function public.reset_student_leaderboard_and_bank_xp(text) to service_role;

-- Execute once at migration-time to fulfill the reset request.
select public.reset_student_leaderboard_and_bank_xp('Initial global leaderboard reset');
