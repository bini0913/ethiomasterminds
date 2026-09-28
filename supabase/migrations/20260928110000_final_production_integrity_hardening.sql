-- Final production integrity hardening.
-- Keep generic XP mutation private to trusted SECURITY DEFINER callers.
revoke execute on function public.add_xp(uuid, integer) from public;
revoke execute on function public.add_xp(uuid, integer) from authenticated;

-- Students may only request quizzes matching the grade recorded on their profile.
-- Staff/admin accounts without a student education_level remain unrestricted.
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
as $function$
declare
  v_user_id uuid := auth.uid();
  v_user_grade text;
  v_education_level text;
  v_requested_grade_num integer;
  v_user_grade_num integer;
  v_requested_is_early boolean := false;
  v_user_is_early boolean := false;
  v_wanted_difficulty text;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_grade is null or length(trim(p_grade)) = 0 or length(trim(p_grade)) > 30 then
    raise exception 'Invalid grade';
  end if;

  if p_subject is null or length(trim(p_subject)) = 0 or length(trim(p_subject)) > 100 then
    raise exception 'Invalid subject';
  end if;

  if p_level is null or p_level < 1 or p_level > 100 then
    raise exception 'Invalid level';
  end if;

  select grade, education_level
    into v_user_grade, v_education_level
  from public.profiles
  where id = v_user_id;

  if v_education_level is not null then
    v_requested_is_early := lower(trim(p_grade)) ~ '^(k|kindergarten|pre-?k)$';
    v_user_is_early := lower(trim(coalesce(v_user_grade, ''))) ~ '^(k|kindergarten|pre-?k)$';

    if not v_requested_is_early then
      v_requested_grade_num := nullif(substring(lower(trim(p_grade)) from '[0-9]+'), '')::integer;
    end if;

    if not v_user_is_early then
      v_user_grade_num := nullif(substring(lower(trim(coalesce(v_user_grade, ''))) from '[0-9]+'), '')::integer;
    end if;

    if v_requested_is_early <> v_user_is_early
       or (not v_requested_is_early and v_requested_grade_num is distinct from v_user_grade_num) then
      raise exception 'Quiz grade does not match the student profile';
    end if;
  end if;

  v_wanted_difficulty := case
    when p_level between 1 and 5 then 'easy'
    when p_level between 6 and 10 then 'medium'
    when p_level between 11 and 20 then 'hard'
    else 'extreme'
  end;

  return query
  select q.id, q.title, q.grade, q.subject, q.difficulty, q.level_min, q.level_max
  from public.quizzes q
  where q.is_approved = true
    and lower(q.grade) = lower(trim(p_grade))
    and lower(q.subject) = lower(trim(p_subject))
    and lower(q.difficulty) = v_wanted_difficulty
  order by q.created_at desc
  limit 1;
end;
$function$;

revoke execute on function public.get_adaptive_quiz(text, text, integer) from public;
grant execute on function public.get_adaptive_quiz(text, text, integer) to authenticated;

-- Secure final quiz submission with bounded timing/payloads and the same
-- student-grade authorization enforced server-side.
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
as $function$
declare
  v_user_id uuid := auth.uid();
  v_quiz public.quizzes%rowtype;
  v_user_grade text;
  v_education_level text;
  v_quiz_grade_num integer;
  v_user_grade_num integer;
  v_quiz_is_early boolean := false;
  v_user_is_early boolean := false;
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

  if p_submission_id is null then
    raise exception 'Submission id is required';
  end if;

  if p_answers is null
     or jsonb_typeof(p_answers) <> 'object'
     or pg_column_size(p_answers) > 100000 then
    raise exception 'Invalid answers payload';
  end if;

  if p_time_taken is null or p_time_taken < 0 or p_time_taken > 7200 then
    raise exception 'Invalid quiz duration';
  end if;

  if exists (
    select 1 from public.quiz_results
    where submission_id = p_submission_id
  ) then
    raise exception 'Duplicate submission';
  end if;

  select *
    into v_quiz
  from public.quizzes
  where id = p_quiz_id
    and is_approved = true;

  if not found then
    raise exception 'No quiz available';
  end if;

  select grade, education_level
    into v_user_grade, v_education_level
  from public.profiles
  where id = v_user_id;

  if v_education_level is not null then
    v_quiz_is_early := lower(trim(coalesce(v_quiz.grade, ''))) ~ '^(k|kindergarten|pre-?k)$';
    v_user_is_early := lower(trim(coalesce(v_user_grade, ''))) ~ '^(k|kindergarten|pre-?k)$';

    if not v_quiz_is_early then
      v_quiz_grade_num := nullif(substring(lower(trim(coalesce(v_quiz.grade, ''))) from '[0-9]+'), '')::integer;
    end if;

    if not v_user_is_early then
      v_user_grade_num := nullif(substring(lower(trim(coalesce(v_user_grade, ''))) from '[0-9]+'), '')::integer;
    end if;

    if v_quiz_is_early <> v_user_is_early
       or (not v_quiz_is_early and v_quiz_grade_num is distinct from v_user_grade_num) then
      raise exception 'Quiz grade does not match the student profile';
    end if;
  end if;

  select count(*) into v_total
  from public.questions
  where quiz_id = p_quiz_id;

  if v_total = 0 or v_total > 100 then
    raise exception 'Invalid quiz question count';
  end if;

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

    insert into public.question_attempts (
      user_id,
      question_id,
      quiz_id,
      selected_answer,
      is_correct,
      time_taken_seconds,
      attempt_number
    ) values (
      v_user_id,
      v_question.id,
      p_quiz_id,
      coalesce(v_selected, 'no_answer'),
      v_correct_bool,
      greatest(0, least(7200, p_time_taken / greatest(v_total, 1))),
      (
        select coalesce(max(qa.attempt_number), 0) + 1
        from public.question_attempts qa
        where qa.user_id = v_user_id
          and qa.question_id = v_question.id
      )
    );
  end loop;

  insert into public.quiz_results (
    quiz_id,
    student_id,
    score,
    total_questions,
    correct_answers,
    time_taken,
    xp_earned,
    answers,
    submission_id
  ) values (
    p_quiz_id,
    v_user_id,
    v_score,
    v_total,
    v_correct,
    p_time_taken,
    v_xp,
    p_answers,
    p_submission_id
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
$function$;

revoke execute on function public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) from public;
grant execute on function public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) to authenticated;
