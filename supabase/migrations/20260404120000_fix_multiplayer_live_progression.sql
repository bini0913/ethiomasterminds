-- Ensure multiplayer rounds progress correctly and reset state on fresh game start

CREATE OR REPLACE FUNCTION public.multiplayer_start_game(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id UUID;
  v_subject TEXT;
  v_difficulty TEXT;
  v_question_count INTEGER;
BEGIN
  -- Verify caller is host
  SELECT host_id, subject, difficulty, question_count 
  INTO v_host_id, v_subject, v_difficulty, v_question_count
  FROM multiplayer_rooms WHERE id = p_room_id;
  
  IF v_host_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the host can start the game';
  END IF;

  -- Clear any previous match data for this room
  DELETE FROM room_answers WHERE room_id = p_room_id;
  DELETE FROM room_questions WHERE room_id = p_room_id;

  UPDATE room_players
  SET score = 0
  WHERE room_id = p_room_id;
  
  -- Select random questions for the room
  INSERT INTO room_questions (room_id, question_id, order_index)
  SELECT p_room_id, q.id, row_number() OVER (ORDER BY random()) - 1
  FROM questions q
  JOIN quizzes qz ON q.quiz_id = qz.id
  WHERE qz.is_approved = true
    AND (v_subject IS NULL OR qz.subject = v_subject)
    AND (v_difficulty IS NULL OR qz.difficulty = v_difficulty)
  ORDER BY random()
  LIMIT COALESCE(v_question_count, 10);
  
  -- Create / reset room state
  INSERT INTO room_state (room_id, status, question_index, current_question_id, question_started_at, question_ends_at)
  VALUES (p_room_id, 'countdown', 0, NULL, NULL, NULL)
  ON CONFLICT (room_id) DO UPDATE SET
    status = 'countdown',
    question_index = 0,
    current_question_id = NULL,
    question_started_at = NULL,
    question_ends_at = NULL,
    updated_at = now();
  
  -- Update room status
  UPDATE multiplayer_rooms SET status = 'playing', started_at = now(), finished_at = NULL WHERE id = p_room_id;
  
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.multiplayer_next_question(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state room_state%ROWTYPE;
  v_next_question_id UUID;
  v_question_data JSONB;
  v_total_questions INTEGER;
BEGIN
  -- Get current state
  SELECT * INTO v_state FROM room_state WHERE room_id = p_room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room state not found';
  END IF;
  
  -- Get total questions
  SELECT COUNT(*) INTO v_total_questions FROM room_questions WHERE room_id = p_room_id;

  IF v_total_questions = 0 THEN
    RAISE EXCEPTION 'No questions configured for this room';
  END IF;
  
  -- Check if game is over (question_index stores the next question pointer)
  IF v_state.question_index >= v_total_questions THEN
    UPDATE room_state SET status = 'finished', updated_at = now() WHERE room_id = p_room_id;
    UPDATE multiplayer_rooms SET status = 'finished', finished_at = now() WHERE id = p_room_id;
    RETURN jsonb_build_object('status', 'finished');
  END IF;
  
  -- Get next question
  SELECT rq.question_id INTO v_next_question_id
  FROM room_questions rq
  WHERE rq.room_id = p_room_id AND rq.order_index = v_state.question_index;

  IF v_next_question_id IS NULL THEN
    UPDATE room_state SET status = 'finished', updated_at = now() WHERE room_id = p_room_id;
    UPDATE multiplayer_rooms SET status = 'finished', finished_at = now() WHERE id = p_room_id;
    RETURN jsonb_build_object('status', 'finished');
  END IF;
  
  -- Get question data
  SELECT jsonb_build_object(
    'id', q.id,
    'question_text', q.question_text,
    'options', q.options,
    'points', q.points
  ) INTO v_question_data
  FROM questions q WHERE q.id = v_next_question_id;
  
  -- Update room state and advance pointer
  UPDATE room_state SET 
    status = 'playing',
    current_question_id = v_next_question_id,
    question_started_at = now(),
    question_ends_at = now() + interval '30 seconds',
    question_index = v_state.question_index + 1,
    updated_at = now()
  WHERE room_id = p_room_id;
  
  RETURN jsonb_build_object(
    'status', 'playing',
    'question', v_question_data,
    'question_index', v_state.question_index + 1,
    'total_questions', v_total_questions
  );
END;
$$;
