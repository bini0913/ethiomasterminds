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


-- Multiplayer gameplay reliability, point scoring and ranked totals.

alter table public.room_players
  add column if not exists completed_at timestamptz;

create table if not exists public.multiplayer_ranked_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_points bigint not null default 0,
  matches_played integer not null default 0,
  wins integer not null default 0,
  podiums integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.multiplayer_ranked_stats enable row level security;

drop policy if exists "ranked stats are readable by authenticated users" on public.multiplayer_ranked_stats;
create policy "ranked stats are readable by authenticated users"
on public.multiplayer_ranked_stats
for select
to authenticated
using (true);

create index if not exists multiplayer_ranked_stats_points_idx
  on public.multiplayer_ranked_stats(total_points desc, wins desc, updated_at asc);

create or replace function public.multiplayer_record_ranked_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.multiplayer_ranked_stats(user_id, total_points, matches_played, wins, podiums, updated_at)
  values (
    new.user_id,
    coalesce(new.score, 0),
    1,
    case when new.placement = 1 then 1 else 0 end,
    case when new.placement <= 3 then 1 else 0 end,
    now()
  )
  on conflict (user_id) do update set
    total_points = public.multiplayer_ranked_stats.total_points + excluded.total_points,
    matches_played = public.multiplayer_ranked_stats.matches_played + 1,
    wins = public.multiplayer_ranked_stats.wins + excluded.wins,
    podiums = public.multiplayer_ranked_stats.podiums + excluded.podiums,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists multiplayer_ranked_result_trigger on public.multiplayer_match_results;
create trigger multiplayer_ranked_result_trigger
after insert on public.multiplayer_match_results
for each row execute function public.multiplayer_record_ranked_result();

create or replace function public.multiplayer_advance_player(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.room_players%rowtype;
  total int;
  next_i int;
  all_done boolean;
begin
  select * into p
  from public.room_players
  where room_id = p_room_id and user_id = auth.uid()
  for update;

  if not found then raise exception 'Not a room player'; end if;

  select count(*)::int into total
  from public.room_questions
  where room_id = p_room_id;

  next_i := p.current_question_index + 1;

  if next_i >= total then
    update public.room_players
    set current_question_index = next_i, completed_at = clock_timestamp()
    where id = p.id;

    select not exists (
      select 1 from public.room_players
      where room_id = p_room_id and completed_at is null
    ) into all_done;

    if all_done then
      update public.multiplayer_rooms
      set status = 'finished', finished_at = clock_timestamp()
      where id = p_room_id and status <> 'finished';

      update public.room_state
      set status = 'finished', updated_at = clock_timestamp()
      where room_id = p_room_id;
    end if;

    return jsonb_build_object('done', true, 'completed', true, 'index', next_i, 'total', total);
  end if;

  update public.room_players
  set current_question_index = next_i
  where id = p.id;

  return public.multiplayer_question_payload(p_room_id, next_i);
end;
$$;

create or replace function public.multiplayer_finish_game(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.multiplayer_rooms%rowtype;
  total int;
  should_finish boolean := false;
begin
  if not exists(
    select 1 from public.room_players
    where room_id = p_room_id and user_id = auth.uid()
  ) then raise exception 'Not a room player'; end if;

  select * into r from public.multiplayer_rooms where id = p_room_id;
  select count(*)::int into total from public.room_questions where room_id = p_room_id;

  if r.game_mode = 'speed'
     and r.started_at is not null
     and clock_timestamp() >= r.started_at + interval '1 minute' then
    should_finish := true;
  elsif r.game_mode = 'accuracy' then
    should_finish :=
      not exists(select 1 from public.room_players where room_id = p_room_id and completed_at is null)
      or exists(
        select 1 from public.room_players
        where room_id = p_room_id
          and completed_at is not null
          and completed_at <= clock_timestamp() - interval '5 seconds'
      );
  end if;

  if should_finish then
    update public.multiplayer_rooms
    set status = 'finished', finished_at = coalesce(finished_at, clock_timestamp())
    where id = p_room_id and status <> 'finished';

    update public.room_state
    set status = 'finished', updated_at = clock_timestamp()
    where room_id = p_room_id;

    return true;
  end if;

  return false;
end;
$$;

create or replace function public.multiplayer_submit_answer(
  p_room_id uuid,
  p_question_id uuid,
  p_answer text,
  p_time_used integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.multiplayer_rooms%rowtype;
  p public.room_players%rowtype;
  q public.questions%rowtype;
  rq public.room_questions%rowtype;
  ok boolean;
  pts int;
  correct_index int;
begin
  select * into r from public.multiplayer_rooms where id = p_room_id;
  if r.status <> 'playing' then raise exception 'Match is not playing'; end if;

  if r.game_mode = 'speed'
     and r.started_at is not null
     and clock_timestamp() >= r.started_at + interval '1 minute' then
    update public.multiplayer_rooms set status = 'finished', finished_at = clock_timestamp()
    where id = p_room_id;
    update public.room_state set status = 'finished', updated_at = clock_timestamp()
    where room_id = p_room_id;
    return jsonb_build_object('finished', true);
  end if;

  select * into p
  from public.room_players
  where room_id = p_room_id and user_id = auth.uid()
  for update;

  if not found then raise exception 'Not a room player'; end if;

  select * into rq
  from public.room_questions
  where room_id = p_room_id
    and question_id = p_question_id
    and order_index = p.current_question_index;

  if not found then raise exception 'That is not your current question'; end if;

  if exists(
    select 1 from public.room_answers
    where room_id = p_room_id and user_id = auth.uid() and question_id = p_question_id
  ) then raise exception 'Question already answered'; end if;

  select * into q from public.questions where id = p_question_id;

  ok := lower(trim(coalesce(p_answer, ''))) = lower(trim(coalesce(q.correct_answer, '')));
  pts := case when ok then greatest(1, coalesce(q.points, 100)) else 0 end;

  select (elem.ordinality - 1)::int into correct_index
  from jsonb_array_elements_text(coalesce(q.options, '[]'::jsonb)) with ordinality elem
  where lower(trim(elem.value)) = lower(trim(coalesce(q.correct_answer, '')))
  limit 1;

  insert into public.room_answers(
    room_id, user_id, question_id, answer, is_correct, points, time_used
  ) values (
    p_room_id, auth.uid(), p_question_id, p_answer, ok, pts,
    greatest(0, coalesce(p_time_used, 0))
  );

  update public.room_players
  set score = score + pts,
      answered_count = answered_count + 1,
      correct_count = correct_count + case when ok then 1 else 0 end,
      current_question_index = case
        when r.game_mode = 'speed' then current_question_index + 1
        else current_question_index
      end
  where id = p.id;

  return jsonb_build_object(
    'is_correct', ok,
    'points', pts,
    'correct_answer', q.correct_answer,
    'correct_index', correct_index,
    'game_mode', r.game_mode,
    'answered_count', p.answered_count + 1,
    'correct_count', p.correct_count + case when ok then 1 else 0 end,
    'score', p.score + pts
  );
end;
$$;

-- Reset completion state whenever a new match starts.
create or replace function public.multiplayer_start_game(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.multiplayer_rooms%rowtype;
  uid uuid := auth.uid();
  n int;
  mode text;
begin
  select * into r from public.multiplayer_rooms where id = p_room_id for update;
  if uid is null then raise exception 'Authentication required'; end if;
  if not found then raise exception 'Room not found'; end if;
  if r.host_id <> uid then raise exception 'Only the host can start the game'; end if;
  if r.status not in ('waiting','countdown') then raise exception 'Room is already started or finished'; end if;
  if (select count(*) from public.room_players where room_id = p_room_id) < 2 then raise exception 'At least 2 players are required'; end if;
  if exists(
    select 1 from public.room_players
    where room_id = p_room_id and user_id <> r.host_id and coalesce(is_ready,false) = false
  ) then raise exception 'All other players must be ready before the host starts'; end if;

  mode := case when lower(coalesce(r.game_mode,'accuracy')) in ('speed','one_minute','1_minute') then 'speed' else 'accuracy' end;
  n := case when mode = 'speed' then 50 else greatest(1, least(coalesce(r.question_count,10),50)) end;

  delete from public.room_answers where room_id = p_room_id;
  delete from public.room_questions where room_id = p_room_id;

  insert into public.room_questions(room_id, question_id, order_index)
  select p_room_id, q.id, row_number() over(order by random()) - 1
  from public.questions q
  join public.quizzes z on z.id = q.quiz_id
  where z.is_approved = true
    and (
      lower(trim(coalesce(r.subject,'mixed'))) = 'mixed'
      or lower(trim(coalesce(z.subject,''))) = lower(trim(coalesce(r.subject,'mixed')))
      or (lower(trim(coalesce(r.subject,''))) in ('math','mathematics')
          and lower(trim(coalesce(z.subject,''))) in ('math','mathematics'))
    )
  order by random() limit n;

  if (select count(*) from public.room_questions where room_id = p_room_id) < n then
    delete from public.room_questions where room_id = p_room_id;
    insert into public.room_questions(room_id, question_id, order_index)
    select p_room_id, q.id, row_number() over(order by random()) - 1
    from public.questions q join public.quizzes z on z.id = q.quiz_id
    where z.is_approved = true
    order by random() limit n;
  end if;

  if not exists(select 1 from public.room_questions where room_id = p_room_id) then
    raise exception 'No approved questions are available for multiplayer';
  end if;

  update public.multiplayer_rooms
  set status = 'playing',
      started_at = clock_timestamp(),
      finished_at = null,
      current_question = 0,
      question_count = (select count(*) from public.room_questions where room_id = p_room_id),
      game_mode = mode
  where id = p_room_id;

  update public.room_players
  set score = 0,
      current_question_index = 0,
      answered_count = 0,
      correct_count = 0,
      completed_at = null
  where room_id = p_room_id;

  insert into public.room_state(room_id,status,question_index,current_question_id,question_started_at,question_ends_at)
  values(p_room_id,'playing',0,null,null,null)
  on conflict(room_id) do update set
    status='playing',
    question_index=0,
    current_question_id=null,
    question_started_at=null,
    question_ends_at=null,
    updated_at=clock_timestamp();

  return jsonb_build_object(
    'status','playing',
    'game_mode',mode,
    'question_count',(select count(*) from public.room_questions where room_id=p_room_id),
    'started_at',(select started_at from public.multiplayer_rooms where id=p_room_id)
  );
end;
$$;

create or replace function public.multiplayer_ranked_leaderboard(p_limit integer default 100)
returns table(
  user_id uuid,
  player_name text,
  total_points bigint,
  matches_played integer,
  wins integer,
  podiums integer,
  rank_position bigint
)
language sql
security definer
set search_path = public
as $$
  select
    s.user_id,
    coalesce(p.name, p.username, 'Player') as player_name,
    s.total_points,
    s.matches_played,
    s.wins,
    s.podiums,
    row_number() over(order by s.total_points desc, s.wins desc, s.updated_at asc) as rank_position
  from public.multiplayer_ranked_stats s
  left join public.profiles p on p.id = s.user_id
  order by s.total_points desc, s.wins desc, s.updated_at asc
  limit greatest(1, least(coalesce(p_limit,100),100));
$$;

grant execute on function public.multiplayer_ranked_leaderboard(integer) to authenticated;

notify pgrst, 'reload schema';
