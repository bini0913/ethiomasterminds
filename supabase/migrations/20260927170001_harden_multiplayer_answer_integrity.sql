-- Harden multiplayer answer integrity and privacy.
DROP POLICY IF EXISTS "Anyone can view room answers" ON public.room_answers;
CREATE POLICY "Players can view room answers"
  ON public.room_answers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.room_players
    WHERE room_id = room_answers.room_id AND user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.multiplayer_submit_answer(
  p_room_id UUID, p_question_id UUID, p_answer TEXT, p_time_used INTEGER
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_state room_state%ROWTYPE;
  v_correct_answer TEXT;
  v_is_correct BOOLEAN;
  v_points INTEGER;
  v_base_points INTEGER;
  v_effective_time INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM room_players WHERE room_id = p_room_id AND user_id = auth.uid())
    THEN RAISE EXCEPTION 'You are not in this room'; END IF;

  SELECT * INTO v_state FROM room_state WHERE room_id = p_room_id;
  IF v_state.room_id IS NULL OR v_state.status <> 'playing'
    THEN RAISE EXCEPTION 'The game is not accepting answers'; END IF;
  IF v_state.current_question_id IS DISTINCT FROM p_question_id
    THEN RAISE EXCEPTION 'This question is not currently active'; END IF;
  IF NOT EXISTS (SELECT 1 FROM room_questions WHERE room_id = p_room_id AND question_id = p_question_id)
    THEN RAISE EXCEPTION 'Question does not belong to this room'; END IF;

  v_effective_time := GREATEST(0, LEAST(COALESCE(p_time_used, 30), 30));
  IF v_state.question_ends_at IS NOT NULL AND now() > v_state.question_ends_at THEN v_effective_time := 30; END IF;

  SELECT correct_answer, COALESCE(points, 10) INTO v_correct_answer, v_base_points
  FROM questions WHERE id = p_question_id;
  IF v_correct_answer IS NULL THEN RAISE EXCEPTION 'Question answer key is unavailable'; END IF;

  v_is_correct := (p_answer = v_correct_answer);
  v_points := CASE WHEN v_is_correct THEN v_base_points + GREATEST(0, (30 - v_effective_time) * 2) ELSE 0 END;

  INSERT INTO room_answers (room_id, user_id, question_id, answer, time_used, is_correct, points)
  VALUES (p_room_id, auth.uid(), p_question_id, p_answer, v_effective_time, v_is_correct, v_points)
  ON CONFLICT (room_id, user_id, question_id) DO NOTHING;

  UPDATE room_players SET score = score + v_points
  WHERE room_id = p_room_id AND user_id = auth.uid();

  RETURN jsonb_build_object('is_correct', v_is_correct, 'points', v_points, 'correct_answer', v_correct_answer);
END;
$$;
