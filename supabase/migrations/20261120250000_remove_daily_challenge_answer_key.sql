-- Daily Challenge grades server-side but does not need to return the answer key.
-- The client already receives correctness and reward status from the trusted RPC.
create or replace function public.submit_daily_challenge_answer(
  p_question_id uuid,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_date date := (now() at time zone 'Africa/Addis_Ababa')::date;
  v_total integer := 0;
  v_offset integer := 0;
  v_question record;
  v_correct boolean;
  v_existing public.daily_challenge_attempts%rowtype;
  v_inserted uuid;
  v_xp integer := 15;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_question_id is null or p_answer is null then raise exception 'Question and answer are required'; end if;

  perform 1 from public.profiles where id = v_user_id for update;
  if not found then raise exception 'Profile not found'; end if;

  select count(*)::integer into v_total
  from public.quizzes z join public.questions q on q.quiz_id = z.id
  where z.is_approved is true;
  if v_total = 0 then raise exception 'No approved daily challenge is available'; end if;

  v_offset := (extract(year from v_date)::integer * 10000
    + extract(month from v_date)::integer * 100
    + extract(day from v_date)::integer) % v_total;
  select q.id, q.correct_answer into v_question
  from public.quizzes z join public.questions q on q.quiz_id = z.id
  where z.is_approved is true
  order by z.created_at desc nulls last, z.id asc, q.order_index asc nulls last, q.id asc
  offset v_offset limit 1;

  if v_question.id is distinct from p_question_id then
    raise exception 'This is not today''s assigned challenge';
  end if;

  v_correct := p_answer = v_question.correct_answer;
  insert into public.daily_challenge_attempts(user_id, challenge_date, question_id, is_correct, xp_awarded)
  values (v_user_id, v_date, v_question.id, v_correct, case when v_correct then v_xp else 0 end)
  on conflict (user_id, challenge_date) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    select * into v_existing from public.daily_challenge_attempts
    where user_id = v_user_id and challenge_date = v_date;
    return jsonb_build_object('success', false, 'already_submitted', true,
      'was_correct', v_existing.is_correct, 'xp_awarded', v_existing.xp_awarded);
  end if;

  if v_correct then
    update public.profiles
    set xp = xp + v_xp,
        level = greatest(1, floor((xp + v_xp) / 100.0)::integer + 1),
        rank = public.calculate_rank(xp + v_xp),
        season_xp = season_xp + v_xp,
        updated_at = now()
    where id = v_user_id;
  end if;

  return jsonb_build_object('success', true, 'already_submitted', false,
    'correct', v_correct, 'xp_awarded', case when v_correct then v_xp else 0 end);
end;
$function$;

revoke all on function public.submit_daily_challenge_answer(uuid, text) from public, anon;
grant execute on function public.submit_daily_challenge_answer(uuid, text) to authenticated;
