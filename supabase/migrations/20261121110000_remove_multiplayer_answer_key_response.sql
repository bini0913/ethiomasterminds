-- Multiplayer grading remains server-authoritative, but the answer key is not
-- needed by the client after submission. Return only correctness and score.
create or replace function public.multiplayer_submit_answer(
  p_room_id uuid,
  p_question_id uuid,
  p_answer text,
  p_time_used integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth
as $$
declare
  r public.multiplayer_rooms%rowtype;
  p public.room_players%rowtype;
  q public.questions%rowtype;
  rq public.room_questions%rowtype;
  ok boolean;
  pts integer;
  elapsed integer;
begin
  select * into r from public.multiplayer_rooms where id = p_room_id;
  if not found or r.status <> 'playing' then raise exception 'Match is not playing'; end if;

  if r.game_mode = 'speed'
     and r.started_at is not null
     and clock_timestamp() >= r.started_at + interval '1 minute' then
    update public.multiplayer_rooms set status = 'finished', finished_at = clock_timestamp() where id = p_room_id and status = 'playing';
    update public.room_state set status = 'finished', updated_at = clock_timestamp() where room_id = p_room_id;
    return jsonb_build_object('finished', true);
  end if;

  select * into p from public.room_players
  where room_id = p_room_id and user_id = auth.uid() for update;
  if not found then raise exception 'Not a room player'; end if;

  select * into rq from public.room_questions
  where room_id = p_room_id
    and question_id = p_question_id
    and order_index = p.current_question_index;
  if not found then raise exception 'That is not your current question'; end if;

  if exists (
    select 1 from public.room_answers
    where room_id = p_room_id and user_id = auth.uid() and question_id = p_question_id
  ) then raise exception 'Question already answered'; end if;

  select * into q from public.questions where id = p_question_id;
  if not found then raise exception 'Question not found'; end if;

  if p_answer is null or length(p_answer) > 500 or not exists (
    select 1 from jsonb_array_elements_text(coalesce(q.options, '[]'::jsonb)) as option_value(value)
    where lower(trim(option_value.value)) = lower(trim(p_answer))
  ) then raise exception 'Answer must match one of the available options'; end if;

  elapsed := greatest(0, extract(epoch from (clock_timestamp() - coalesce(p.question_started_at, clock_timestamp())))::integer);
  ok := lower(trim(p_answer)) = lower(trim(coalesce(q.correct_answer, '')))
    and (r.game_mode = 'speed' or elapsed <= 30);
  pts := case when ok then greatest(1, coalesce(q.points, 100)) else 0 end;

  insert into public.room_answers(room_id, user_id, question_id, answer, is_correct, points, time_used)
  values (p_room_id, auth.uid(), p_question_id, trim(p_answer), ok, pts, elapsed);

  update public.room_players
  set score = coalesce(score, 0) + pts,
      answered_count = answered_count + 1,
      correct_count = correct_count + case when ok then 1 else 0 end,
      current_question_index = case when r.game_mode = 'speed' then current_question_index + 1 else current_question_index end
  where id = p.id;

  return jsonb_build_object(
    'is_correct', ok,
    'points', pts,
    'game_mode', r.game_mode,
    'answered_count', p.answered_count + 1,
    'correct_count', p.correct_count + case when ok then 1 else 0 end,
    'score', coalesce(p.score, 0) + pts,
    'time_used', elapsed,
    'timed_out', r.game_mode = 'accuracy' and elapsed > 30
  );
end;
$$;

revoke all on function public.multiplayer_submit_answer(uuid, uuid, text, integer) from public, anon;
grant execute on function public.multiplayer_submit_answer(uuid, uuid, text, integer) to authenticated;
