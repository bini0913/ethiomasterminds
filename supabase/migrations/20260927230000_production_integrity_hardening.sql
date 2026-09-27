-- Production integrity hardening batch.
-- Rewards, study sessions, quiz scope, Early achievements, and admin RPC authorization.

-- 1) The generic XP RPC is an internal primitive, not a browser reward API.
revoke execute on function public.add_xp(uuid, integer) from public, anon, authenticated;

-- 2) Study sessions: rewards must be based on server elapsed time, not a client-supplied duration.
create or replace function public.complete_study_session(
  p_session_id uuid,
  p_duration_override integer default null,
  p_task_id uuid default null,
  p_mark_task_complete boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.study_sessions%rowtype;
  v_elapsed_seconds integer;
  v_minutes integer;
  v_max_minutes integer;
  v_xp integer;
  v_coins integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_session
  from public.study_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Session not found';
  end if;

  if v_session.user_id <> auth.uid() then
    raise exception 'Not your session';
  end if;

  if v_session.status <> 'active' then
    raise exception 'Session is already completed';
  end if;

  if v_session.start_time > now() then
    raise exception 'Invalid session start time';
  end if;

  v_elapsed_seconds := greatest(0, floor(extract(epoch from (now() - v_session.start_time)))::integer);
  if v_elapsed_seconds < 60 then
    raise exception 'Study for at least 1 minute before ending the session';
  end if;

  v_max_minutes := greatest(
    1,
    least(coalesce(v_session.planned_duration, 180), 180)
  );

  -- Ignore p_duration_override for reward calculation. The server clock wins.
  v_minutes := greatest(1, least(ceil(v_elapsed_seconds / 60.0)::integer, v_max_minutes));
  v_xp := v_minutes * 10;
  v_coins := greatest(1, v_minutes / 5);

  update public.study_sessions
     set status = 'completed',
         end_time = now(),
         duration = v_minutes
   where id = p_session_id
     and status = 'active';

  if not found then
    raise exception 'Session could not be completed';
  end if;

  insert into public.study_live_status (
    user_id, is_studying, current_session_start, updated_at
  ) values (
    auth.uid(), false, null, now()
  )
  on conflict (user_id) do update
    set is_studying = false,
        current_session_start = null,
        updated_at = now();

  if v_session.competition_id is not null then
    insert into public.study_participants (
      competition_id, user_id, total_study_time
    ) values (
      v_session.competition_id, auth.uid(), v_minutes
    )
    on conflict (competition_id, user_id)
    do update set total_study_time =
      public.study_participants.total_study_time + v_minutes;
  end if;

  if p_task_id is not null and p_mark_task_complete then
    update public.study_tasks
       set completed = true
     where id = p_task_id
       and user_id = auth.uid();
  end if;

  perform public.add_xp(auth.uid(), v_xp);

  insert into public.user_currency (user_id, coins)
  values (auth.uid(), v_coins)
  on conflict (user_id) do update
    set coins = public.user_currency.coins + v_coins,
        updated_at = now();

  return jsonb_build_object(
    'minutes', v_minutes,
    'xp_earned', v_xp,
    'coins_earned', v_coins
  );
end;
$$;

grant execute on function public.complete_study_session(uuid, integer, uuid, boolean) to authenticated;

-- 3) Quiz submissions: validate time and bind approved quiz content to the student's grade.
create or replace function public.submit_quiz_result_secure(
  p_quiz_id uuid,
  p_answers jsonb,
  p_time_taken integer,
  p_submission_id uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quiz public.quizzes%rowtype;
  v_user_grade text;
  v_user_grade_num integer;
  v_quiz_grade_num integer;
  v_total integer;
  v_correct integer := 0;
  v_score integer := 0;
  v_xp integer := 0;
  v_question record;
  v_selected text;
  v_correct_bool boolean;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Answers payload must be a JSON object';
  end if;

  if p_submission_id is null then
    raise exception 'Submission id is required';
  end if;

  if exists (
    select 1 from public.quiz_results
    where submission_id = p_submission_id
  ) then
    raise exception 'Duplicate submission';
  end if;

  select * into v_quiz
  from public.quizzes
  where id = p_quiz_id
    and is_approved = true;

  if not found then
    raise exception 'No quiz available';
  end if;

  select grade into v_user_grade
  from public.profiles
  where id = v_user_id;

  v_user_grade_num := case
    when lower(trim(coalesce(v_user_grade,''))) ~ '^(k|kindergarten|pre-?k)$' then 0
    when lower(trim(coalesce(v_user_grade,''))) ~ '^(?:grade\\s*)?[0-9]{1,2}\\+?$'
      then substring(lower(trim(v_user_grade)) from '[0-9]{1,2}')::integer
    else null
  end;

  v_quiz_grade_num := case
    when lower(trim(coalesce(v_quiz.grade,''))) ~ '^(?:grade\\s*)?[0-9]{1,2}\\+?$'
      then substring(lower(trim(v_quiz.grade)) from '[0-9]{1,2}')::integer
    else null
  end;

  if v_quiz_grade_num is not null and
     (v_user_grade_num is null or v_quiz_grade_num <> v_user_grade_num) then
    raise exception 'Quiz is outside your assigned grade';
  end if;

  select count(*) into v_total
  from public.questions
  where quiz_id = p_quiz_id;

  if v_total = 0 then
    raise exception 'No questions available';
  end if;

  -- The app timer is 20 seconds/question. Allow a small submission margin,
  -- but reject obviously fabricated durations.
  if p_time_taken is null or p_time_taken < 0 or p_time_taken > (v_total * 20 + 30) then
    raise exception 'Invalid quiz duration';
  end if;

  for v_question in
    select id, correct_answer, coalesce(difficulty, v_quiz.difficulty) as difficulty, points
    from public.questions
    where quiz_id = p_quiz_id
    order by order_index, created_at
  loop
    v_selected := p_answers ->> (v_question.id::text);
    v_correct_bool := v_selected is not null
      and v_selected = v_question.correct_answer;

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

    insert into public.question_attempts (
      user_id, question_id, quiz_id, selected_answer,
      is_correct, time_taken_seconds, attempt_number
    ) values (
      v_user_id,
      v_question.id,
      p_quiz_id,
      coalesce(v_selected, 'no_answer'),
      v_correct_bool,
      case
        when v_total > 0 then greatest(0, floor(p_time_taken::numeric / v_total)::integer)
        else 0
      end,
      1
    );
  end loop;

  insert into public.quiz_results (
    quiz_id, student_id, score, total_questions, correct_answers,
    time_taken, xp_earned, answers, submission_id
  ) values (
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

grant execute on function public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) to authenticated;

-- Direct quiz_attempts inserts let clients fabricate progression records.
revoke insert on table public.quiz_attempts from anon, authenticated;

-- 4) Admin season reporting functions must not expose all student season data to
-- arbitrary authenticated users.
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
  if not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager')) then
    raise exception 'Permission denied';
  end if;

  select * into v_state
  from public.season_runtime_state
  where id = 1;

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

create or replace function public.admin_get_season_rewards_preview(
  p_conversion_rate numeric default 0.1,
  p_limit integer default 10
) returns table(
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
  if not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager')) then
    raise exception 'Permission denied';
  end if;

  if p_conversion_rate is null or p_conversion_rate < 0 or p_conversion_rate > 10 then
    raise exception 'Invalid conversion rate';
  end if;

  return query
  select p.id, p.name, coalesce(p.season_xp,0),
    row_number() over (order by p.season_xp desc nulls last)::int,
    greatest(0, floor(coalesce(p.season_xp,0) * p_conversion_rate))::int,
    case
      when row_number() over (order by p.season_xp desc nulls last) = 1 then 'Champion'
      when row_number() over (order by p.season_xp desc nulls last) <= 3 then 'Podium'
      when row_number() over (order by p.season_xp desc nulls last) <= 10 then 'Top 10'
      else null
    end
  from public.profiles p
  where coalesce(p.season_xp,0) > 0
  order by p.season_xp desc nulls last
  limit greatest(1, least(coalesce(p_limit,10),100));
end;
$$;

grant execute on function public.admin_get_current_season_stats() to authenticated;
grant execute on function public.admin_get_season_rewards_preview(numeric, integer) to authenticated;

-- 5) Early achievement unlocks must be proven by server-side progress.
create or replace function public.complete_early_activity(
  p_attempt_id uuid,
  p_activity_id text,
  p_skill text,
  p_correct boolean,
  p_completed boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_grade text;
  v_xp_reward integer := 0;
  v_coin_reward integer := 0;
  v_xp integer;
  v_level integer;
  v_rank text;
  v_coins integer;
  v_achievement_key text;
  v_achievement_id uuid;
  v_requirement_type text;
  v_requirement_value integer;
  v_current_progress integer := 0;
  v_attempts integer := 0;
  v_correct_answers integer := 0;
begin
  if v_user_id is null then raise exception 'Unauthorized'; end if;
  if p_attempt_id is null then raise exception 'Attempt id is required'; end if;
  if p_activity_id is null or length(trim(p_activity_id)) = 0 then raise exception 'Activity id is required'; end if;
  if p_skill is null or length(trim(p_skill)) = 0 then raise exception 'Skill is required'; end if;

  select grade into v_grade from public.profiles where id = v_user_id;
  if v_grade is null or not (
    lower(trim(v_grade)) ~ '^(k|kindergarten|pre-?k)$'
    or lower(trim(v_grade)) ~ '^(?:grade\\s*)?[1-4]\\+?$'
  ) then
    raise exception 'Early activities are only available to KG through Grade 4';
  end if;

  if exists (
    select 1 from public.early_activity_attempts
    where id = p_attempt_id and user_id = v_user_id
  ) then
    select xp, level, rank into v_xp, v_level, v_rank from public.profiles where id = v_user_id;
    select coins into v_coins from public.user_currency where user_id = v_user_id;
    return jsonb_build_object('processed',false,'duplicate',true,'xp',coalesce(v_xp,0),'level',coalesce(v_level,1),'rank',v_rank,'coins',coalesce(v_coins,0));
  end if;

  if trim(p_activity_id) like 'achievement-%' then
    v_achievement_key := substring(trim(p_activity_id) from 13);

    select id, reward_xp, reward_coins, requirement_type, requirement_value
      into v_achievement_id, v_xp_reward, v_coin_reward, v_requirement_type, v_requirement_value
    from public.early_achievements
    where key = v_achievement_key and active = true;

    if not found then raise exception 'Unknown Early achievement'; end if;

    select
      coalesce(sum(ep.completions),0),
      coalesce(sum(ep.attempts),0),
      coalesce(sum(ep.correct_answers),0),
      coalesce(sum(ep.xp_earned),0)
      into v_current_progress, v_attempts, v_correct_answers, v_xp
    from public.early_activity_progress ep
    where ep.user_id = v_user_id;

    if v_requirement_type = 'math_attempts' then
      select coalesce(sum(attempts),0) into v_current_progress
      from public.early_activity_progress
      where user_id=v_user_id and skill in ('number sense','shapes','patterns');
    elsif v_requirement_type = 'reading_attempts' then
      select coalesce(sum(attempts),0) into v_current_progress
      from public.early_activity_progress
      where user_id=v_user_id and skill in ('vocabulary','phonics');
    elsif v_requirement_type = 'science_attempts' then
      select coalesce(sum(attempts),0) into v_current_progress
      from public.early_activity_progress
      where user_id=v_user_id and skill='animals';
    elsif v_requirement_type = 'coding_attempts' then
      select coalesce(sum(attempts),0) into v_current_progress
      from public.early_activity_progress
      where user_id=v_user_id and skill='sequencing';
    elsif v_requirement_type = 'accuracy_80' then
      if v_attempts >= 10 and (v_correct_answers::numeric / greatest(v_attempts,1)) >= 0.8 then
        v_current_progress := 10;
      else
        v_current_progress := least(v_attempts,10);
      end if;
    elsif v_requirement_type = 'xp_earned' then
      v_current_progress := v_xp;
    end if;

    if v_current_progress < v_requirement_value then
      raise exception 'Achievement requirement not met';
    end if;

    if exists (
      select 1 from public.early_user_achievements
      where user_id=v_user_id and achievement_id=v_achievement_id and completed=true
    ) then
      select xp, level, rank into v_xp, v_level, v_rank from public.profiles where id=v_user_id;
      select coins into v_coins from public.user_currency where user_id=v_user_id;
      return jsonb_build_object('processed',false,'duplicate',true,'xp',coalesce(v_xp,0),'level',coalesce(v_level,1),'rank',v_rank,'coins',coalesce(v_coins,0));
    end if;
  elsif trim(p_activity_id) like 'quiz-%' then
    v_xp_reward := 8; v_coin_reward := 3;
  elsif trim(p_activity_id) in (
    'number-quest','word-match','shape-hunt','pattern-builder','memory-match',
    'odd-one-out','sort-safari','animal-detective','word-builder','coding-robot'
  ) then
    v_xp_reward := 5; v_coin_reward := 2;
  elsif trim(p_activity_id) = 'early-discover' then
    v_xp_reward := 5; v_coin_reward := 2;
  else
    raise exception 'Unknown Early activity';
  end if;

  if v_achievement_id is not null then
    insert into public.early_user_achievements(user_id,achievement_id,progress,completed,unlocked_at)
    values(v_user_id,v_achievement_id,v_requirement_value,true,now())
    on conflict (user_id,achievement_id) do update set
      progress=excluded.progress,
      completed=true,
      unlocked_at=coalesce(public.early_user_achievements.unlocked_at,now());
  end if;

  insert into public.early_activity_attempts(
    id,user_id,activity_id,skill,correct,xp_earned,coins_earned
  ) values(
    p_attempt_id,v_user_id,trim(p_activity_id),trim(p_skill),p_correct,
    case when p_correct then v_xp_reward else 0 end,
    case when p_correct then v_coin_reward else 0 end
  );

  insert into public.early_activity_progress(
    user_id,activity_id,skill,attempts,correct_answers,completions,xp_earned,coins_earned,last_played_at
  ) values(
    v_user_id,trim(p_activity_id),trim(p_skill),1,
    case when p_correct then 1 else 0 end,
    case when p_completed then 1 else 0 end,
    case when p_correct then v_xp_reward else 0 end,
    case when p_correct then v_coin_reward else 0 end,
    now()
  )
  on conflict (user_id,activity_id) do update set
    attempts=public.early_activity_progress.attempts+1,
    correct_answers=public.early_activity_progress.correct_answers+case when p_correct then 1 else 0 end,
    completions=public.early_activity_progress.completions+case when p_completed then 1 else 0 end,
    xp_earned=public.early_activity_progress.xp_earned+case when p_correct then v_xp_reward else 0 end,
    coins_earned=public.early_activity_progress.coins_earned+case when p_correct then v_coin_reward else 0 end,
    skill=excluded.skill,
    last_played_at=now();

  if p_correct and v_xp_reward > 0 then
    update public.profiles
       set xp=coalesce(xp,0)+v_xp_reward,
           level=floor((coalesce(xp,0)+v_xp_reward)/100)+1,
           rank=public.calculate_rank(coalesce(xp,0)+v_xp_reward)
     where id=v_user_id
     returning xp,level,rank into v_xp,v_level,v_rank;
  else
    select xp,level,rank into v_xp,v_level,v_rank from public.profiles where id=v_user_id;
  end if;

  insert into public.user_currency(user_id,coins)
  values(v_user_id,case when p_correct then v_coin_reward else 0 end)
  on conflict(user_id) do update set
    coins=public.user_currency.coins+case when p_correct then v_coin_reward else 0 end,
    updated_at=now()
  returning coins into v_coins;

  return jsonb_build_object(
    'processed',true,
    'duplicate',false,
    'xp',coalesce(v_xp,0),
    'level',coalesce(v_level,1),
    'rank',v_rank,
    'coins',coalesce(v_coins,0),
    'reward_xp',case when p_correct then v_xp_reward else 0 end,
    'reward_coins',case when p_correct then v_coin_reward else 0 end
  );
end;
$$;

grant execute on function public.complete_early_activity(uuid,text,text,boolean,boolean) to authenticated;
