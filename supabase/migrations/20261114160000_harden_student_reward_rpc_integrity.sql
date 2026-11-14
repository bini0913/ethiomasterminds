-- Tighten the remaining student-account RPC paths that can affect
-- account moderation or award profile XP.

create or replace function public.manager_set_student_status(
  p_user_id uuid,
  p_status text,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public._is_manager_or_admin() then
    raise exception 'Manager access required';
  end if;

  if p_user_id is null or p_status not in ('active', 'suspended', 'banned') then
    raise exception 'Invalid account status request';
  end if;

  if not exists (
    select 1
    from public.user_roles
    where user_id = p_user_id
      and role = 'student'::public.app_role
  ) then
    raise exception 'Managers can only moderate student accounts';
  end if;

  update public.profiles
  set account_status = p_status,
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'Student profile not found';
  end if;

  insert into public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  values (
    auth.uid(),
    'manager_set_student_status',
    'user',
    p_user_id,
    jsonb_build_object('status', p_status, 'reason', p_reason)
  );

  return true;
end;
$function$;

revoke all on function public.manager_set_student_status(uuid, text, text) from public, anon;
grant execute on function public.manager_set_student_status(uuid, text, text) to authenticated;

-- Quiz submissions are scored by comparing answers with the database answer
-- key. Idempotency is scoped to the authenticated owner, not just a UUID.
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
  q record;
  v_answer text;
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
  if p_time_taken is null or p_time_taken < 0 or p_time_taken > 86400 then
    raise exception 'Invalid quiz duration';
  end if;

  select difficulty
    into v_difficulty
  from public.quizzes
  where id = p_quiz_id;

  if not found then
    raise exception 'Quiz not found';
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

  select count(*)::integer
    into v_total_questions
  from public.questions
  where quiz_id = p_quiz_id;

  if v_total_questions = 0 then
    raise exception 'Quiz has no questions';
  end if;

  for q in
    select id, correct_answer
    from public.questions
    where quiz_id = p_quiz_id
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
      'already_submitted', true
    );
  end if;

  return jsonb_build_object(
    'xp_earned', v_xp_earned,
    'already_submitted', false
  );
end;
$function$;

revoke all on function public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) from public, anon;
grant execute on function public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) to authenticated;

-- Serialize reward claims on the result row. Concurrent duplicate claims now
-- wait for the first transaction and cannot award XP twice.
create or replace function public.claim_quiz_reward(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_row public.quiz_results%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_submission_id is null then
    raise exception 'Submission identifier is required';
  end if;

  select *
    into v_row
  from public.quiz_results
  where submission_id = p_submission_id
    and student_id = v_user_id
  for update;

  if not found then
    raise exception 'Quiz submission not found';
  end if;

  if v_row.claimed then
    return jsonb_build_object(
      'xp_awarded', 0,
      'already_claimed', true
    );
  end if;

  if coalesce(v_row.xp_earned, 0) < 0 then
    raise exception 'Invalid stored quiz reward';
  end if;

  update public.quiz_results
  set claimed = true
  where id = v_row.id;

  perform public.add_xp(v_user_id, coalesce(v_row.xp_earned, 0));

  return jsonb_build_object(
    'xp_awarded', coalesce(v_row.xp_earned, 0),
    'already_claimed', false
  );
end;
$function$;

revoke all on function public.claim_quiz_reward(uuid) from public, anon;
grant execute on function public.claim_quiz_reward(uuid) to authenticated;
