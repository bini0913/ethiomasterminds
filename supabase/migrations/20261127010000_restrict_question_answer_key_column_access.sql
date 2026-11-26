-- Remove the answer key from direct client reads while preserving safe question
-- fields for student practice. Authorized teachers use a guarded RPC.
revoke select on table public.questions from anon, authenticated;

grant select (
  id,
  created_at,
  explanation,
  options,
  order_index,
  points,
  question_text,
  question_type,
  quiz_id,
  option_a,
  option_b,
  option_c,
  option_d,
  difficulty,
  grade,
  subject,
  topic
) on table public.questions to authenticated;

create or replace function public.get_teacher_quiz_questions(p_quiz_id uuid)
returns table (
  id uuid,
  question_text text,
  options jsonb,
  correct_answer text,
  explanation text,
  points integer,
  order_index integer
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_quiz_id is null or not exists (
    select 1
      from public.quizzes quiz
     where quiz.id = p_quiz_id
       and (
         public.has_role(v_user_id, 'teacher'::public.app_role)
         or public.has_role(v_user_id, 'admin'::public.app_role)
         or public.has_role(v_user_id, 'manager'::public.app_role)
         or public.has_role(v_user_id, 'extreme_admin'::public.app_role)
         or public.school_can_manage_school_quiz(quiz.id)
       )
  ) then
    raise exception using errcode = '42501', message = 'You are not authorized to view this quiz answer key';
  end if;

  return query
  select q.id, q.question_text, q.options, q.correct_answer,
         q.explanation, q.points, q.order_index
    from public.questions q
   where q.quiz_id = p_quiz_id
   order by q.order_index;
end;
$function$;

revoke all on function public.get_teacher_quiz_questions(uuid) from public, anon;
grant execute on function public.get_teacher_quiz_questions(uuid) to authenticated;

comment on function public.get_teacher_quiz_questions(uuid) is
  'Returns answer keys only to authorized teacher and school quiz managers; student clients must use prompt-only question access.';
