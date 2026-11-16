-- Master Minds security/integrity hardening batch.
-- Keep progression and study rewards server-authoritative.

-- 1) The legacy generic XP RPC must not be callable from the browser.
-- It is retained only for trusted SECURITY DEFINER server-side callers while
-- older database objects are migrated away from it.
revoke all on function public.add_xp(uuid, integer) from public;
revoke all on function public.add_xp(uuid, integer) from anon;
revoke all on function public.add_xp(uuid, integer) from authenticated;

create or replace function public.add_xp(p_user_id uuid, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_xp integer;
  v_new_xp integer;
  v_current_level integer;
  v_new_level integer;
  v_new_rank text;
  v_leveled_up boolean := false;
  v_coins_to_add integer := 0;
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 or p_amount > 500 then
    raise exception 'Invalid XP grant';
  end if;

  select xp, level into v_current_xp, v_current_level
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  v_new_xp := coalesce(v_current_xp, 0) + p_amount;
  v_new_level := floor(v_new_xp / 100) + 1;
  v_new_rank := calculate_rank(v_new_xp);
  v_leveled_up := v_new_level > coalesce(v_current_level, 1);

  update public.profiles
     set xp = v_new_xp,
         level = v_new_level,
         rank = v_new_rank,
         season_xp = greatest(0, coalesce(season_xp, 0) + p_amount)
   where id = p_user_id;

  v_coins_to_add := floor(p_amount / 100);
  if v_coins_to_add > 0 then
    insert into public.user_currency(user_id, coins)
    values (p_user_id, v_coins_to_add)
    on conflict (user_id) do update
      set coins = public.user_currency.coins + v_coins_to_add,
          updated_at = now();
  end if;

  return jsonb_build_object(
    'previous_xp', v_current_xp,
    'new_xp', v_new_xp,
    'xp_gained', p_amount,
    'previous_level', v_current_level,
    'new_level', v_new_level,
    'leveled_up', v_leveled_up,
    'rank', v_new_rank,
    'coins_added', v_coins_to_add
  );
end;
$$;

-- 2) Study sessions: clients can no longer manufacture old start times,
-- overwrite durations, or edit earned competition time.
drop policy if exists "Users manage own sessions" on public.study_sessions;
drop policy if exists "Users view own sessions" on public.study_sessions;
create policy "Users view own sessions"
on public.study_sessions for select to authenticated
using (auth.uid() = user_id);

revoke insert, update, delete on public.study_sessions from authenticated;

create or replace function public.start_study_session(
  p_planned_duration integer,
  p_mode text default 'pomodoro',
  p_competition_id uuid default null
)
returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.study_sessions%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_planned_duration is null or p_planned_duration < 5 or p_planned_duration > 180 then
    raise exception 'Study duration must be between 5 and 180 minutes';
  end if;
  if p_mode is null or p_mode not in ('pomodoro','deep','custom') then
    raise exception 'Invalid study mode';
  end if;

  if exists (
    select 1 from public.study_sessions
    where user_id = v_uid and status = 'active'
  ) then
    raise exception 'You already have an active study session';
  end if;

  if p_competition_id is not null and not exists (
    select 1 from public.study_competitions
    where id = p_competition_id
      and status = 'active'
      and start_time <= now()
      and (end_time is null or end_time >= now())
  ) then
    raise exception 'Study competition is not active';
  end if;

  insert into public.study_sessions(
    user_id, start_time, planned_duration, mode, status, competition_id
  )
  values (
    v_uid, now(), p_planned_duration, p_mode, 'active', p_competition_id
  )
  returning * into v_session;

  return v_session;
end;
$$;

revoke all on function public.start_study_session(integer,text,uuid) from public;
grant execute on function public.start_study_session(integer,text,uuid) to authenticated;

create or replace function public.complete_study_session(
  p_session_id uuid,
  p_duration_override integer default null,
  p_task_id uuid default null,
  p_mark_task_complete boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.study_sessions%rowtype;
  v_elapsed_seconds bigint;
  v_minutes integer;
  v_xp integer;
  v_coins integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_session
  from public.study_sessions
  where id = p_session_id
    and user_id = v_uid
  for update;

  if not found then raise exception 'Study session not found'; end if;
  if v_session.status <> 'active' then raise exception 'Study session is already completed'; end if;
  if v_session.start_time > now() + interval '1 minute' then
    raise exception 'Invalid study session start time';
  end if;

  v_elapsed_seconds := greatest(0, extract(epoch from (now() - v_session.start_time))::bigint);
  if v_elapsed_seconds < 60 then
    raise exception 'Study for at least 1 minute before ending the session';
  end if;

  -- The client-provided duration is intentionally ignored. Reward is derived
  -- from server time and capped at the planned duration.
  v_minutes := least(
    greatest(1, ceil(v_elapsed_seconds / 60.0)::integer),
    greatest(1, coalesce(v_session.planned_duration, 180))
  );
  v_xp := v_minutes * 10;
  v_coins := greatest(1, floor(v_minutes / 5.0)::integer);

  update public.study_sessions
     set status = 'completed',
         end_time = now(),
         duration = v_minutes
   where id = v_session.id;

  insert into public.study_live_status(
    user_id, is_studying, current_session_start, updated_at
  )
  values (v_uid, false, null, now())
  on conflict (user_id) do update
    set is_studying = false,
        current_session_start = null,
        updated_at = now();

  if v_session.competition_id is not null then
    insert into public.study_participants(
      competition_id, user_id, total_study_time
    )
    values (v_session.competition_id, v_uid, v_minutes)
    on conflict (competition_id, user_id)
    do update set
      total_study_time = public.study_participants.total_study_time + excluded.total_study_time;
  end if;

  if p_task_id is not null and p_mark_task_complete then
    update public.study_tasks
       set completed = true
     where id = p_task_id and user_id = v_uid;
  end if;

  -- Directly award the verified amount; do not call the browser-callable legacy
  -- XP function.
  update public.profiles
     set xp = coalesce(xp, 0) + v_xp,
         level = floor((coalesce(xp, 0) + v_xp) / 100) + 1,
         rank = calculate_rank(coalesce(xp, 0) + v_xp),
         season_xp = greatest(0, coalesce(season_xp, 0) + v_xp)
   where id = v_uid;

  insert into public.user_currency(user_id, coins)
  values (v_uid, v_coins + floor(v_xp / 100.0)::integer)
  on conflict (user_id) do update
    set coins = public.user_currency.coins + excluded.coins,
        updated_at = now();

  return jsonb_build_object(
    'minutes', v_minutes,
    'xp_earned', v_xp,
    'coins_earned', v_coins + floor(v_xp / 100.0)::integer
  );
end;
$$;

revoke all on function public.complete_study_session(uuid,integer,uuid,boolean) from public;
grant execute on function public.complete_study_session(uuid,integer,uuid,boolean) to authenticated;

-- Competition time is progression-owned. Students may join with zero time,
-- but cannot directly edit their accumulated total.
drop policy if exists "Users join competitions" on public.study_participants;
drop policy if exists "Users update own participation" on public.study_participants;
create policy "Users join competitions"
on public.study_participants for insert to authenticated
with check (auth.uid() = user_id and total_study_time = 0);

-- 3) Quiz access/integrity: users can only submit quizzes in their own
-- education tier, and submitted time is bounded.
create or replace function public.get_adaptive_quiz(
  p_grade text,
  p_subject text,
  p_level integer
)
returns table (
  quiz_id uuid,
  title text,
  grade text,
  subject text,
  difficulty text,
  level_min integer,
  level_max integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_grade text;
  v_user_num integer;
  v_requested_num integer;
  v_user_tier integer;
  v_requested_tier integer;
  v_wanted_difficulty text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select grade into v_user_grade from public.profiles where id = auth.uid();
  v_user_num := nullif(substring(lower(trim(coalesce(v_user_grade,''))) from '([0-9]{1,2})'), '')::integer;
  v_requested_num := nullif(substring(lower(trim(coalesce(p_grade,''))) from '([0-9]{1,2})'), '')::integer;

  v_user_tier := case
    when v_user_grade ~* '^(k|kindergarten|pre-?k)$' or coalesce(v_user_num,0) between 1 and 4 then 1
    when coalesce(v_user_num,0) between 5 and 8 then 2
    when coalesce(v_user_num,0) between 9 and 12 then 3
    else 0
  end;

  v_requested_tier := case
    when coalesce(v_requested_num,0) between 1 and 4 then 1
    when coalesce(v_requested_num,0) between 5 and 8 then 2
    when coalesce(v_requested_num,0) between 9 and 12 then 3
    else 0
  end;

  if v_user_tier = 0 or v_requested_tier = 0 or v_user_tier <> v_requested_tier then
    raise exception 'Quiz grade is outside your education tier';
  end if;

  v_wanted_difficulty := case
    when coalesce(p_level,1) between 1 and 5 then 'easy'
    when coalesce(p_level,1) between 6 and 10 then 'medium'
    when coalesce(p_level,1) between 11 and 20 then 'hard'
    else 'extreme'
  end;

  return query
  select q.id, q.title, q.grade, q.subject, q.difficulty, q.level_min, q.level_max
  from public.quizzes q
  where q.is_approved = true
    and lower(q.grade) = lower(p_grade)
    and lower(q.subject) = lower(p_subject)
    and lower(q.difficulty) = v_wanted_difficulty
  order by q.created_at desc
  limit 1;
end;
$$;

revoke all on function public.get_adaptive_quiz(text,text,integer) from public;
grant execute on function public.get_adaptive_quiz(text,text,integer) to authenticated;

create or replace function public.submit_quiz_result_secure(
  p_quiz_id uuid,
  p_answers jsonb,
  p_time_taken integer,
  p_submission_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_grade text;
  v_user_num integer;
  v_user_tier integer;
  v_quiz public.quizzes%rowtype;
  v_quiz_num integer;
  v_quiz_tier integer;
  v_max_time integer;
  v_total integer;
  v_correct integer := 0;
  v_score integer := 0;
  v_xp integer := 0;
  v_question record;
  v_selected text;
  v_correct_bool boolean;
begin
  if v_user_id is null then raise exception 'Unauthorized'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Answers payload must be a JSON object';
  end if;
  if p_submission_id is null then raise exception 'Submission id is required'; end if;
  if p_time_taken is null or p_time_taken < 0 or p_time_taken > 3600 then
    raise exception 'Invalid quiz time';
  end if;
  if exists (select 1 from public.quiz_results where submission_id = p_submission_id) then
    raise exception 'Duplicate submission';
  end if;

  select grade into v_user_grade from public.profiles where id = v_user_id;
  v_user_num := nullif(substring(lower(trim(coalesce(v_user_grade,''))) from '([0-9]{1,2})'), '')::integer;
  v_user_tier := case
    when v_user_grade ~* '^(k|kindergarten|pre-?k)$' or coalesce(v_user_num,0) between 1 and 4 then 1
    when coalesce(v_user_num,0) between 5 and 8 then 2
    when coalesce(v_user_num,0) between 9 and 12 then 3
    else 0
  end;

  select * into v_quiz
  from public.quizzes
  where id = p_quiz_id and is_approved = true;

  if not found then raise exception 'No quiz available'; end if;

  v_quiz_num := nullif(substring(lower(trim(coalesce(v_quiz.grade,''))) from '([0-9]{1,2})'), '')::integer;
  v_quiz_tier := case
    when v_quiz.grade ~* '^(k|kindergarten|pre-?k)$' or coalesce(v_quiz_num,0) between 1 and 4 then 1
    when coalesce(v_quiz_num,0) between 5 and 8 then 2
    when coalesce(v_quiz_num,0) between 9 and 12 then 3
    else 0
  end;

  if v_user_tier = 0 or v_quiz_tier = 0 or v_user_tier <> v_quiz_tier then
    raise exception 'Quiz is outside your education tier';
  end if;

  v_max_time := greatest(60, least(3600, coalesce(v_quiz.time_limit, 600) * 2));
  if p_time_taken > v_max_time then
    raise exception 'Quiz time exceeds the allowed limit';
  end if;

  select count(*) into v_total
  from public.questions where quiz_id = p_quiz_id;
  if v_total = 0 then raise exception 'No questions available'; end if;

  for v_question in
    select id, correct_answer, coalesce(difficulty, v_quiz.difficulty) as difficulty, points
    from public.questions
    where quiz_id = p_quiz_id
    order by order_index, created_at
  loop
    v_selected := p_answers ->> (v_question.id::text);
    v_correct_bool := v_selected is not null and v_selected = v_question.correct_answer;

    if v_correct_bool then
      v_correct := v_correct + 1;
      v_score := v_score + coalesce(v_question.points, 10);
      case lower(v_question.difficulty)
        when 'easy' then v_xp := v_xp + 2;
        when 'medium' then v_xp := v_xp + 4;
        when 'hard' then v_xp := v_xp + 6;
        else v_xp := v_xp + 8;
      end case;
    else
      case lower(v_question.difficulty)
        when 'hard' then v_xp := v_xp - 2;
        when 'extreme' then v_xp := v_xp - 3;
        else v_xp := v_xp;
      end case;
    end if;

    insert into public.question_attempts(
      user_id, question_id, quiz_id, selected_answer, is_correct,
      time_taken_seconds, attempt_number
    )
    values(
      v_user_id, v_question.id, p_quiz_id, coalesce(v_selected,'no_answer'),
      v_correct_bool,
      greatest(1, p_time_taken / greatest(v_total,1)),
      1
    );
  end loop;

  insert into public.quiz_results(
    quiz_id, student_id, score, total_questions, correct_answers,
    time_taken, xp_earned, answers, submission_id
  )
  values(
    p_quiz_id, v_user_id, v_score, v_total, v_correct,
    p_time_taken, v_xp, p_answers, p_submission_id
  );

  return jsonb_build_object(
    'quiz_id', p_quiz_id,
    'score', v_score,
    'total_questions', v_total,
    'correct_answers', v_correct,
    'xp_earned', v_xp,
    'difficulty', v_quiz.difficulty
  );
end;
$$;

revoke all on function public.submit_quiz_result_secure(uuid,jsonb,integer,uuid) from public;
grant execute on function public.submit_quiz_result_secure(uuid,jsonb,integer,uuid) to authenticated;

-- 4) Season admin RPCs must not expose profile/season data to ordinary students.
revoke all on function public.admin_get_current_season_stats() from public;
revoke all on function public.admin_get_current_season_stats() from anon;
revoke all on function public.admin_get_current_season_stats() from authenticated;
grant execute on function public.admin_get_current_season_stats() to authenticated;

create or replace function public.admin_get_current_season_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.season_runtime_state%rowtype;
  v_total_users integer;
  v_total_xp bigint;
  v_top_name text;
begin
  if not (has_role(auth.uid(),'admin') or has_role(auth.uid(),'manager')) then
    raise exception 'Permission denied';
  end if;

  select * into v_state from public.season_runtime_state where id = 1;
  select count(*), coalesce(sum(season_xp),0)
    into v_total_users, v_total_xp
  from public.profiles
  where season_xp > 0;
  select name into v_top_name
  from public.profiles
  order by season_xp desc nulls last
  limit 1;

  return jsonb_build_object(
    'season_name', v_state.current_season_name,
    'season_number', v_state.season_number,
    'started_at', v_state.started_at,
    'total_users', coalesce(v_total_users,0),
    'total_xp', coalesce(v_total_xp,0),
    'top_player', coalesce(v_top_name,'—')
  );
end;
$$;

revoke all on function public.admin_get_season_rewards_preview(numeric,integer) from public;
revoke all on function public.admin_get_season_rewards_preview(numeric,integer) from anon;
revoke all on function public.admin_get_season_rewards_preview(numeric,integer) from authenticated;
grant execute on function public.admin_get_season_rewards_preview(numeric,integer) to authenticated;

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
  if not (has_role(auth.uid(),'admin') or has_role(auth.uid(),'manager')) then
    raise exception 'Permission denied';
  end if;
  if p_conversion_rate is null or p_conversion_rate < 0 or p_conversion_rate > 10 then
    raise exception 'Invalid conversion rate';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid limit';
  end if;

  return query
  select p.id, p.name, coalesce(p.season_xp,0),
    row_number() over(order by p.season_xp desc nulls last)::int,
    greatest(0, floor(coalesce(p.season_xp,0) * p_conversion_rate))::int,
    case
      when row_number() over(order by p.season_xp desc nulls last) = 1 then 'Champion'
      when row_number() over(order by p.season_xp desc nulls last) <= 3 then 'Podium'
      when row_number() over(order by p.season_xp desc nulls last) <= 10 then 'Top 10'
      else null
    end
  from public.profiles p
  where coalesce(p.season_xp,0) > 0
  order by p.season_xp desc nulls last
  limit p_limit;
end;
$$;

revoke all on function public.admin_force_start_new_season(text) from public;
revoke all on function public.admin_force_start_new_season(text) from anon;
revoke all on function public.admin_force_start_new_season(text) from authenticated;
grant execute on function public.admin_force_start_new_season(text) to authenticated;

create or replace function public.admin_force_start_new_season(p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (has_role(auth.uid(),'admin') or has_role(auth.uid(),'manager')) then
    raise exception 'Permission denied';
  end if;
  return public.admin_end_season(0.1, coalesce(p_reason,'Forced start'), 'CONFIRM');
end;
$$;
