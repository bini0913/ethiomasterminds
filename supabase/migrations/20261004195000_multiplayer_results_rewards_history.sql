create table if not exists public.multiplayer_match_results (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.multiplayer_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  placement integer not null check (placement > 0),
  player_count integer not null check (player_count > 0),
  score integer not null default 0,
  correct_answers integer not null default 0,
  answered_questions integer not null default 0,
  total_questions integer not null default 0,
  accuracy numeric(5,2) not null default 0,
  xp_earned integer not null default 0,
  coins_earned integer not null default 0,
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create index if not exists multiplayer_match_results_user_created_idx
  on public.multiplayer_match_results(user_id, created_at desc);

alter table public.multiplayer_match_results enable row level security;

drop policy if exists "Players can view results for their matches" on public.multiplayer_match_results;
create policy "Players can view results for their matches"
  on public.multiplayer_match_results
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.room_players rp
      where rp.room_id = multiplayer_match_results.room_id
        and rp.user_id = (select auth.uid())
    )
  );

revoke all on public.multiplayer_match_results from anon;
grant select on public.multiplayer_match_results to authenticated;

create or replace function public.finalize_multiplayer_results()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  rec record;
  total_players integer;
  total_questions integer;
  xp_reward integer;
  coin_reward integer;
  accuracy_value numeric(5,2);
begin
  if new.status <> 'finished' or old.status = 'finished' then
    return new;
  end if;

  select count(*)::integer
    into total_players
  from public.room_players
  where room_id = new.id;

  select count(*)::integer
    into total_questions
  from public.room_questions
  where room_id = new.id;

  if total_players = 0 then
    return new;
  end if;

  for rec in
    select
      rp.user_id,
      coalesce(rp.score, 0) as score,
      coalesce(rp.correct_count, 0) as correct_count,
      coalesce(rp.answered_count, 0) as answered_count,
      rp.joined_at,
      row_number() over (
        order by
          coalesce(rp.score, 0) desc,
          coalesce(rp.correct_count, 0) desc,
          coalesce(rp.answered_count, 0) desc,
          rp.joined_at asc
      )::integer as placement
    from public.room_players rp
    where rp.room_id = new.id
  loop
    xp_reward := case
      when rec.placement = 1 then 100
      when rec.placement = 2 then 75
      when rec.placement = 3 then 50
      else 25
    end;

    coin_reward := case
      when rec.placement = 1 then 50
      when rec.placement = 2 then 30
      when rec.placement = 3 then 20
      else 10
    end;

    accuracy_value := case
      when rec.answered_count > 0
        then round((rec.correct_count::numeric / rec.answered_count::numeric) * 100, 2)
      else 0
    end;

    insert into public.multiplayer_match_results (
      room_id,
      user_id,
      placement,
      player_count,
      score,
      correct_answers,
      answered_questions,
      total_questions,
      accuracy,
      xp_earned,
      coins_earned
    )
    values (
      new.id,
      rec.user_id,
      rec.placement,
      total_players,
      rec.score,
      rec.correct_count,
      rec.answered_count,
      total_questions,
      accuracy_value,
      xp_reward,
      coin_reward
    )
    on conflict (room_id, user_id) do nothing;

    if found then
      update public.profiles
      set
        xp = coalesce(xp, 0) + xp_reward,
        season_xp = coalesce(season_xp, 0) + xp_reward,
        updated_at = now()
      where id = rec.user_id;

      insert into public.user_currency (user_id, coins, gems)
      values (rec.user_id, coin_reward, 0)
      on conflict (user_id)
      do update set
        coins = coalesce(public.user_currency.coins, 0) + excluded.coins,
        updated_at = now();
    end if;
  end loop;

  return new;
end;
$function$;

drop trigger if exists trg_finalize_multiplayer_results on public.multiplayer_rooms;
create trigger trg_finalize_multiplayer_results
after update of status on public.multiplayer_rooms
for each row
when (old.status is distinct from new.status and new.status = 'finished')
execute function public.finalize_multiplayer_results();

revoke all on function public.finalize_multiplayer_results() from public, anon, authenticated;
