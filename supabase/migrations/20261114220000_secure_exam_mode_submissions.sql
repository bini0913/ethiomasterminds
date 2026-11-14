-- Server-authoritative persistence for configurable Academic Prep exams.
-- Unlike the standard quiz RPC, this accepts the exact question subset shown
-- to the learner, so exam totals and grading cannot drift to the full quiz bank.

create or replace function public.submit_exam_result_secure(
  p_quiz_id uuid,
  p_question_ids uuid[],
  p_answers jsonb,
  p_time_taken integer,
  p_submission_id uuid,
  p_exam_type text default 'mixed_practice',
  p_subject text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_difficulty text;
  v_quiz_subject text;
  v_subject text;
  v_exam_type text;
  v_total_questions integer;
  v_distinct_questions integer;
  v_correct_count integer := 0;
  v_xp_per_correct integer;
  v_wrong_penalty integer;
  v_xp_earned integer;
  v_score integer;
  v_existing public.quiz_results%rowtype;
  v_inserted public.quiz_results%rowtype;
  v_progress record;
  v_existing_progress public.topic_progress%rowtype;
  q record;
  v_answer text;
  v_topic text;
  v_attempted integer;
  v_correct integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_quiz_id is null or p_submission_id is null then
    raise exception 'Quiz and submission identifiers are required';
  end if;
  if p_question_ids is null or cardinality(p_question_ids) < 1 or cardinality(p_question_ids) > 200 then
    raise exception 'Select between 1 and 200 exam questions';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Answers must be a JSON object';
  end if;
  if p_time_taken is null or p_time_taken < 0 or p_time_taken > 86400 then
    raise exception 'Invalid exam duration';
  end if;
  if exists (
    select 1
    from jsonb_each(p_answers) answer_entry
    where jsonb_typeof(answer_entry.value) <> 'string'
  ) then
    raise exception 'Every submitted answer must be text';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(p_answers) answer_key
    where not exists (
      select 1 from unnest(p_question_ids) selected_id
      where selected_id::text = answer_key
    )
  ) then
    raise exception 'Answers include a question outside this exam';
  end if;

  select difficulty, subject
    into v_difficulty, v_quiz_subject
  from public.quizzes
  where id = p_quiz_id
    and is_approved is true;
  if not found then
    raise exception 'Approved quiz not found';
  end if;

  select count(distinct selected_id)::integer
    into v_distinct_questions
  from unnest(p_question_ids) as ids(selected_id);
  if v_distinct_questions <> cardinality(p_question_ids) then
    raise exception 'Duplicate question identifiers are not allowed';
  end if;

  select count(*)::integer
    into v_total_questions
  from public.questions
  where quiz_id = p_quiz_id
    and id = any(p_question_ids);
  if v_total_questions <> cardinality(p_question_ids) then
    raise exception 'One or more questions do not belong to this approved quiz';
  end if;

  v_difficulty := coalesce(v_difficulty, 'medium');
  v_xp_per_correct := case lower(v_difficulty)
    when 'easy' then 2
    when 'medium' then 4
    when 'hard' then 6
    when 'extreme' then 8
    else 4
  end;
  v_wrong_penalty := case lower(v_difficulty)
    when 'hard' then 2
    when 'extreme' then 3
    else 0
  end;

  for q in
    select id, correct_answer
    from public.questions
    where quiz_id = p_quiz_id
      and id = any(p_question_ids)
  loop
    v_answer := p_answers ->> q.id::text;
    if v_answer is not null and v_answer = q.correct_answer then
      v_correct_count := v_correct_count + 1;
    end if;
  end loop;

  v_xp_earned := greatest(
    0,
    (v_correct_count * v_xp_per_correct)
      - ((v_total_questions - v_correct_count) * v_wrong_penalty)
  );
  v_score := v_correct_count * 10;
  v_subject := coalesce(nullif(btrim(p_subject), ''), v_quiz_subject, 'General');
  v_exam_type := case
    when p_exam_type in ('mixed_practice', 'mock_exam', 'past_paper', 'topic_practice', 'general')
      then p_exam_type
    else 'mixed_practice'
  end;

  insert into public.quiz_results (
    quiz_id, student_id, exam_type, subject, score, total_questions,
    correct_answers, time_taken, xp_earned, answers, submission_id, claimed
  )
  values (
    p_quiz_id, v_user_id, v_exam_type, v_subject, v_score, v_total_questions,
    v_correct_count, p_time_taken, v_xp_earned, p_answers, p_submission_id, false
  )
  on conflict (submission_id) do nothing
  returning * into v_inserted;

  if not found then
    select *
      into v_existing
    from public.quiz_results
    where submission_id = p_submission_id
    for update;

    if not found or v_existing.student_id is distinct from v_user_id then
      raise exception 'Submission identifier is already in use';
    end if;

    return jsonb_build_object(
      'xp_earned', coalesce(v_existing.xp_earned, 0),
      'correct_answers', v_existing.correct_answers,
      'total_questions', v_existing.total_questions,
      'already_submitted', true
    );
  end if;

  -- Persist mastery evidence in the same transaction as the graded result.
  for v_progress in
    select
      coalesce(nullif(btrim(question.topic), ''), 'General') as topic,
      count(*)::integer as attempted,
      count(*) filter (
        where p_answers ->> question.id::text = question.correct_answer
      )::integer as correct
    from public.questions question
    where question.quiz_id = p_quiz_id
      and question.id = any(p_question_ids)
    group by coalesce(nullif(btrim(question.topic), ''), 'General')
  loop
    v_topic := v_progress.topic;
    v_attempted := v_progress.attempted;
    v_correct := v_progress.correct;

    select *
      into v_existing_progress
    from public.topic_progress
    where user_id = v_user_id
      and lower(subject) = lower(v_subject)
      and lower(topic) = lower(v_topic)
    limit 1
    for update;

    if found then
      update public.topic_progress
      set questions_attempted = coalesce(v_existing_progress.questions_attempted, 0) + v_attempted,
          questions_correct = coalesce(v_existing_progress.questions_correct, 0) + v_correct,
          accuracy_percentage = case
            when coalesce(v_existing_progress.questions_attempted, 0) + v_attempted > 0
              then round(
                ((coalesce(v_existing_progress.questions_correct, 0) + v_correct)::numeric
                / (coalesce(v_existing_progress.questions_attempted, 0) + v_attempted)) * 100
              )::integer
            else 0
          end,
          completion_percentage = least(
            100,
            round(((coalesce(v_existing_progress.questions_attempted, 0) + v_attempted)::numeric / 5) * 100)::integer
          )
      where id = v_existing_progress.id;
    else
      insert into public.topic_progress (
        user_id, subject, topic, questions_attempted, questions_correct,
        accuracy_percentage, completion_percentage
      )
      values (
        v_user_id, v_subject, v_topic, v_attempted, v_correct,
        case when v_attempted > 0 then round((v_correct::numeric / v_attempted) * 100)::integer else 0 end,
        least(100, round((v_attempted::numeric / 5) * 100)::integer)
      );
    end if;
  end loop;

  return jsonb_build_object(
    'xp_earned', v_xp_earned,
    'correct_answers', v_correct_count,
    'total_questions', v_total_questions,
    'already_submitted', false
  );
end;
$function$;

revoke all on function public.submit_exam_result_secure(uuid, uuid[], jsonb, integer, uuid, text, text) from public, anon;
grant execute on function public.submit_exam_result_secure(uuid, uuid[], jsonb, integer, uuid, text, text) to authenticated;
