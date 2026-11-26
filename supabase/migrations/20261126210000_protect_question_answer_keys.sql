-- Keep question prompts readable to students, but never expose answer keys
-- through direct Data API table reads. Privileged authoring uses a role-checked RPC.
revoke all on table public.questions from anon;
revoke select on table public.questions from public, authenticated;
revoke select (correct_answer) on table public.questions from public, anon, authenticated;
revoke truncate, references, trigger on table public.questions from authenticated;

grant select (
  id,
  quiz_id,
  question_text,
  question_type,
  options,
  explanation,
  points,
  order_index,
  created_at,
  option_a,
  option_b,
  option_c,
  option_d,
  difficulty,
  grade,
  subject,
  topic
) on table public.questions to authenticated;

create or replace function public.get_question_authoring_bank(p_quiz_ids uuid[] default null)
returns table (
  id uuid,
  quiz_id uuid,
  question_text text,
  question_type text,
  options jsonb,
  correct_answer text,
  explanation text,
  points integer,
  order_index integer,
  created_at timestamptz,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  difficulty text,
  grade text,
  subject text,
  topic text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_quiz_ids is not null and cardinality(p_quiz_ids) > 200 then
    raise exception 'A maximum of 200 quizzes can be requested at once';
  end if;

  if p_quiz_ids is not null and cardinality(p_quiz_ids) = 0 then
    return;
  end if;

  return query
  select
    q.id,
    q.quiz_id,
    q.question_text,
    q.question_type,
    q.options,
    q.correct_answer,
    q.explanation,
    q.points,
    q.order_index,
    q.created_at,
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d,
    q.difficulty,
    q.grade,
    q.subject,
    q.topic
  from public.questions q
  join public.quizzes quiz on quiz.id = q.quiz_id
  where (p_quiz_ids is null or q.quiz_id = any(p_quiz_ids))
    and (
      public.has_role(v_user_id, 'extreme_admin'::public.app_role)
      or public.has_role(v_user_id, 'admin'::public.app_role)
      or public.has_role(v_user_id, 'manager'::public.app_role)
      or public.has_role(v_user_id, 'teacher'::public.app_role)
      or quiz.created_by = v_user_id
      or (
        quiz.school_id is not null
        and public.school_can_manage_school_quiz(quiz.id)
      )
    )
  order by
    case when p_quiz_ids is not null then q.order_index end asc nulls last,
    q.created_at desc nulls last
  limit 200;
end;
$$;

revoke all on function public.get_question_authoring_bank(uuid[]) from public, anon;
grant execute on function public.get_question_authoring_bank(uuid[]) to authenticated;
