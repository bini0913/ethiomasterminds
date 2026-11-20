-- Student exam sessions must not receive answer keys before submission.
-- This RPC exposes review data only after the authenticated student owns a saved result.
create or replace function public.get_exam_submission_review(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_result public.quiz_results%rowtype;
  v_review jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_result
  from public.quiz_results
  where submission_id = p_submission_id
    and student_id = v_user_id;

  if not found then
    raise exception 'Exam submission not found';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'question_id', q.id,
    'question_text', q.question_text,
    'options', q.options,
    'answer', coalesce(v_result.answers ->> q.id::text, ''),
    'correct_answer', q.correct_answer,
    'explanation', q.explanation,
    'topic', q.topic
  ) order by q.order_index), '[]'::jsonb)
  into v_review
  from public.questions q
  where q.quiz_id = v_result.quiz_id
    and q.id::text in (select jsonb_object_keys(v_result.answers));

  return jsonb_build_object(
    'submission_id', p_submission_id,
    'correct_answers', v_result.correct_answers,
    'total_questions', v_result.total_questions,
    'review', v_review
  );
end;
$function$;

revoke all on function public.get_exam_submission_review(uuid) from public, anon;
grant execute on function public.get_exam_submission_review(uuid) to authenticated;
