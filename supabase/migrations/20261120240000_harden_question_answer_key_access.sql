-- Keep Grades 5–8's existing quiz behavior intact, while preventing upper-tier
-- students from reading answer keys through the questions table. Upper-tier
-- learners receive prompt-only rows through get_student_question_bank below.
drop policy if exists "Students can view questions for assigned quizzes" on public.questions;
drop policy if exists "view questions of visible quiz" on public.questions;
create policy "view questions of visible quiz" on public.questions
for select to authenticated
using (
  exists (
    select 1
    from public.quizzes quiz
    where quiz.id = questions.quiz_id
      and (
        public.has_role(auth.uid(), 'teacher'::public.app_role)
        or public.has_role(auth.uid(), 'admin'::public.app_role)
        or public.has_role(auth.uid(), 'manager'::public.app_role)
        or public.has_role(auth.uid(), 'extreme_admin'::public.app_role)
        or (
          quiz.grade < 9
          and (
            (quiz.school_id is null and quiz.is_approved is true)
            or (quiz.school_id is not null and public.school_can_view_school_quiz(quiz.id))
          )
        )
      )
  )
);

create or replace function public.get_student_question_bank(p_quiz_ids uuid[])
returns table (
  id uuid,
  quiz_id uuid,
  question_text text,
  question_type text,
  options jsonb,
  explanation text,
  points integer,
  order_index integer,
  created_at timestamptz,
  topic text,
  option_a text,
  option_b text,
  option_c text,
  option_d text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_quiz_ids is null or cardinality(p_quiz_ids) = 0 or cardinality(p_quiz_ids) > 500 then
    raise exception 'A non-empty quiz selection is required';
  end if;

  return query
  select
    q.id,
    q.quiz_id,
    q.question_text,
    q.question_type,
    q.options,
    q.explanation,
    q.points,
    q.order_index,
    q.created_at,
    q.topic,
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d
  from public.questions q
  join public.quizzes quiz on quiz.id = q.quiz_id
  where q.quiz_id = any(p_quiz_ids)
    and (
      (quiz.school_id is null and quiz.is_approved is true)
      or (quiz.school_id is not null and public.school_can_view_school_quiz(quiz.id))
    )
  order by q.order_index;
end;
$function$;

revoke all on function public.get_student_question_bank(uuid[]) from public, anon;
grant execute on function public.get_student_question_bank(uuid[]) to authenticated;
