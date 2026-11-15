-- Restore subset-aware quiz scoring after the later reward hardening migration
-- accidentally replaced it with whole-source-quiz scoring.
create or replace function public.submit_quiz_result_secure(
  p_quiz_id uuid,
  p_answers jsonb,
  p_time_taken integer,
  p_submission_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_difficulty text;
  v_total_questions integer;
  v_correct_count integer := 0;
  v_xp_per_correct integer;
  v_wrong_penalty integer;
  v_xp_earned integer;
  v_score integer;
  v_existing public.quiz_results%rowtype;
  v_inserted public.quiz_results%rowtype;
  v_attempt_number integer;
  q record;
  v_answer text;
  v_is_correct boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_quiz_id is null or p_submission_id is null then
    raise exception 'Quiz and submission identifiers are required';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Answers must be a JSON object';
  end if;

  if jsonb_object_length(p_answers) = 0 or jsonb_object_length(p_answers) > 100 then
    raise exception 'The submitted question set is empty or too large';
  end if;

  if p_time_taken is null or p_time_taken < 0 or p_time_taken > 86400 then
    raise exception 'Invalid quiz duration';
  end if;

  select difficulty
    into v_difficulty
  from public.quizzes
  where id = p_quiz_id
    and is_approved is true;

  if not found then
    raise exception 'Approved quiz not found';
  end if;

  -- Reject answer keys that do not belong to this real source quiz.
  if exists (
    select 1
    from jsonb_object_keys(p_answers) as supplied(question_id)
    where not exists (
      select 1
      from public.questions q
      where q.quiz_id = p_quiz_id
        and q.id::text = supplied.question_id
    )
  ) then
    raise exception 'The submission contains a question outside this quiz';
  end if;

  select count(*)::integer
    into v_total_questions
  from public.questions q
  where q.quiz_id = p_quiz_id
    and p_answers ? q.id::text;

  if v_total_questions = 0 then
    raise exception 'No submitted questions belong to this quiz';
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

  -- Grade only the submitted subset, not every question in the source quiz.
  for q in
    select id, correct_answer
    from public.questions
    where quiz_id = p_quiz_id
      and p_answers ? id::text
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

  -- Insert the result first. Duplicate submissions return before attempt rows
  -- are inserted, so retries cannot inflate Learning DNA history.
  insert into public.quiz_results (
    quiz_id, student_id, score, total_questions, correct_answers,
    time_taken, xp_earned, answers, submission_id, claimed
  )
  values (
    p_quiz_id, v_user_id, v_score, v_total_questions, v_correct_count,
    p_time_taken, v_xp_earned, p_answers, p_submission_id, false
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
      'total_questions', v_existing.total_questions,
      'correct_answers', v_existing.correct_answers,
      'already_submitted', true
    );
  end if;

  -- Persist only questions actually shown in this submission. Correctness is
  -- recalculated from the database answer key, never accepted from the client.
  for q in
    select id, correct_answer
    from public.questions
    where quiz_id = p_quiz_id
      and p_answers ? id::text
  loop
    v_answer := p_answers ->> q.id::text;
    v_is_correct := v_answer is not null and v_answer = q.correct_answer;

    select coalesce(max(qa.attempt_number), 0) + 1
      into v_attempt_number
    from public.question_attempts qa
    where qa.user_id = v_user_id
      and qa.question_id = q.id;

    insert into public.question_attempts (
      user_id,
      question_id,
      quiz_id,
      selected_answer,
      is_correct,
      time_taken_seconds,
      attempt_number
    )
    values (
      v_user_id,
      q.id,
      p_quiz_id,
      coalesce(v_answer, 'no_answer'),
      v_is_correct,
      greatest(0, p_time_taken / v_total_questions),
      v_attempt_number
    );
  end loop;

  return jsonb_build_object(
    'xp_earned', v_xp_earned,
    'total_questions', v_total_questions,
    'correct_answers', v_correct_count,
    'already_submitted', false
  );
end;
$function$;

revoke all on function public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) from public, anon;

revoke all on function public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) from public, anon;
grant execute on function public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) to authenticated;
