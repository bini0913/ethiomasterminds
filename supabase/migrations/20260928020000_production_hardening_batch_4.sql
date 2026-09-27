-- Master Minds production hardening batch 4.
-- Close remaining SECURITY DEFINER authorization gaps and legacy RPC execution paths.

-- Internal progression/economy primitives must never be callable directly by clients.
REVOKE ALL ON FUNCTION public.add_xp(uuid, integer) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.apply_xp_reward(uuid, integer, boolean) FROM PUBLIC, authenticated;

-- User-scoped analytics/streak/achievement helpers must be bound to the caller.
CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak public.user_streaks%ROWTYPE;
  v_today date := current_date;
  v_yesterday date := current_date - 1;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_streak FROM public.user_streaks WHERE user_id = p_user_id FOR UPDATE;

  IF v_streak IS NULL THEN
    INSERT INTO public.user_streaks(user_id,current_streak,longest_streak,last_activity_date)
    VALUES(p_user_id,1,1,v_today)
    RETURNING * INTO v_streak;
  ELSIF v_streak.last_activity_date = v_today THEN
    NULL;
  ELSIF v_streak.last_activity_date = v_yesterday THEN
    UPDATE public.user_streaks
    SET current_streak=current_streak+1,
        longest_streak=greatest(longest_streak,current_streak+1),
        last_activity_date=v_today,
        updated_at=now()
    WHERE user_id=p_user_id
    RETURNING * INTO v_streak;
  ELSE
    UPDATE public.user_streaks
    SET current_streak=1,last_activity_date=v_today,updated_at=now()
    WHERE user_id=p_user_id
    RETURNING * INTO v_streak;
  END IF;

  RETURN jsonb_build_object(
    'current_streak',coalesce(v_streak.current_streak,0),
    'longest_streak',coalesce(v_streak.longest_streak,0),
    'streak_maintained',true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_analytics(
  p_user_id uuid,
  p_subject text,
  p_correct integer,
  p_total integer,
  p_avg_time numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_total IS NULL OR p_total < 1 OR p_total > 100 THEN
    RAISE EXCEPTION 'Invalid question total';
  END IF;
  IF p_correct IS NULL OR p_correct < 0 OR p_correct > p_total THEN
    RAISE EXCEPTION 'Invalid correct-answer count';
  END IF;
  IF p_avg_time IS NULL OR p_avg_time < 0 OR p_avg_time > 7200 THEN
    RAISE EXCEPTION 'Invalid average time';
  END IF;
  IF p_subject IS NULL OR length(trim(p_subject)) = 0 OR length(p_subject) > 100 THEN
    RAISE EXCEPTION 'Invalid subject';
  END IF;

  INSERT INTO public.analytics(
    user_id,subject,total_correct,total_questions_attempted,accuracy,average_time_per_question
  )
  VALUES(
    p_user_id,trim(p_subject),p_correct,p_total,
    (p_correct::decimal / p_total * 100),p_avg_time
  )
  ON CONFLICT ON CONSTRAINT analytics_user_subject_unique DO UPDATE SET
    total_correct=public.analytics.total_correct+p_correct,
    total_questions_attempted=public.analytics.total_questions_attempted+p_total,
    accuracy=((public.analytics.total_correct+p_correct)::decimal /
      NULLIF(public.analytics.total_questions_attempted+p_total,0) * 100),
    average_time_per_question=(public.analytics.average_time_per_question+p_avg_time)/2,
    last_updated=now();
END;
$$;

CREATE OR REPLACE FUNCTION public.check_achievements(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_achievement record;
  v_progress integer;
  v_newly_earned jsonb := '[]'::jsonb;
  v_stats jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_stats := public.get_user_stats(p_user_id);

  FOR v_achievement IN
    SELECT a.*
    FROM public.achievements a
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_achievements ua
      WHERE ua.user_id=p_user_id AND ua.achievement_id=a.id AND ua.completed=true
    )
  LOOP
    v_progress := CASE v_achievement.requirement_type
      WHEN 'quizzes_completed' THEN (v_stats->>'total_quizzes')::integer
      WHEN 'xp_earned' THEN (v_stats->>'xp')::integer
      WHEN 'level_reached' THEN (v_stats->>'level')::integer
      WHEN 'streak_days' THEN (v_stats->>'current_streak')::integer
      WHEN 'accuracy' THEN (v_stats->>'accuracy')::integer
      ELSE 0
    END;

    INSERT INTO public.user_achievements(user_id,achievement_id,progress,completed,unlocked_at)
    VALUES(
      p_user_id,v_achievement.id,v_progress,
      v_progress >= v_achievement.requirement_value,
      CASE WHEN v_progress >= v_achievement.requirement_value THEN now() ELSE NULL END
    )
    ON CONFLICT(user_id,achievement_id) DO UPDATE SET
      progress=EXCLUDED.progress,
      completed=EXCLUDED.completed,
      unlocked_at=CASE
        WHEN EXCLUDED.completed AND public.user_achievements.unlocked_at IS NULL THEN now()
        ELSE public.user_achievements.unlocked_at
      END;

    IF v_progress >= v_achievement.requirement_value THEN
      v_newly_earned := v_newly_earned || jsonb_build_object(
        'id',v_achievement.id,
        'name',v_achievement.name,
        'xp_reward',v_achievement.reward_xp,
        'coins_reward',v_achievement.reward_coins
      );
      IF v_achievement.reward_xp > 0 THEN
        PERFORM public.add_xp(p_user_id,v_achievement.reward_xp);
      END IF;
      IF v_achievement.reward_coins > 0 THEN
        UPDATE public.user_currency
        SET coins=coins+v_achievement.reward_coins,updated_at=now()
        WHERE user_id=p_user_id;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'newly_earned',v_newly_earned,
    'total_checked',(SELECT count(*) FROM public.achievements)
  );
END;
$$;

-- Dashboard/stat RPCs are private to the authenticated owner.
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_total_quizzes integer;
  v_total_correct integer;
  v_total_questions integer;
  v_accuracy decimal;
  v_current_streak integer;
  v_longest_streak integer;
  v_achievements_count integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id=p_user_id;
  SELECT count(DISTINCT quiz_id),coalesce(sum(correct_answers),0),coalesce(sum(total_questions),0)
    INTO v_total_quizzes,v_total_correct,v_total_questions
  FROM public.quiz_results WHERE student_id=p_user_id;
  v_accuracy := CASE WHEN v_total_questions > 0
    THEN v_total_correct::decimal / v_total_questions * 100 ELSE 0 END;
  SELECT current_streak,longest_streak INTO v_current_streak,v_longest_streak
  FROM public.user_streaks WHERE user_id=p_user_id;
  SELECT count(*) INTO v_achievements_count
  FROM public.user_achievements WHERE user_id=p_user_id AND completed=true;

  RETURN jsonb_build_object(
    'xp',coalesce(v_profile.xp,0),
    'level',coalesce(v_profile.level,1),
    'rank',v_profile.rank,
    'total_quizzes',coalesce(v_total_quizzes,0),
    'accuracy',round(v_accuracy,1),
    'current_streak',coalesce(v_current_streak,0),
    'longest_streak',coalesce(v_longest_streak,0),
    'achievements_earned',coalesce(v_achievements_count,0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_currency public.user_currency%ROWTYPE;
  v_streak public.user_streaks%ROWTYPE;
  v_stats jsonb;
  v_recent_quizzes jsonb;
  v_achievements_count integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id=p_user_id;
  SELECT * INTO v_currency FROM public.user_currency WHERE user_id=p_user_id;
  SELECT * INTO v_streak FROM public.user_streaks WHERE user_id=p_user_id;
  v_stats := public.get_user_stats(p_user_id);
  SELECT count(*) INTO v_achievements_count
  FROM public.user_achievements WHERE user_id=p_user_id AND completed=true;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'quiz_id',qr.quiz_id,'score',qr.score,'completed_at',qr.completed_at,'xp_earned',qr.xp_earned
    ) ORDER BY qr.completed_at DESC),'[]'::jsonb)
  INTO v_recent_quizzes
  FROM (
    SELECT quiz_id,score,completed_at,xp_earned
    FROM public.quiz_results
    WHERE student_id=p_user_id
    ORDER BY completed_at DESC LIMIT 5
  ) qr;

  RETURN jsonb_build_object(
    'profile',jsonb_build_object(
      'id',v_profile.id,'name',v_profile.name,'username',v_profile.username,
      'avatar',v_profile.avatar,'avatar_config',v_profile.avatar_config,
      'xp',v_profile.xp,'level',v_profile.level,'rank',v_profile.rank
    ),
    'currency',jsonb_build_object(
      'coins',coalesce(v_currency.coins,100),'gems',coalesce(v_currency.gems,10)
    ),
    'streak',jsonb_build_object(
      'current',coalesce(v_streak.current_streak,0),
      'longest',coalesce(v_streak.longest_streak,0),
      'last_activity',v_streak.last_activity_date
    ),
    'stats',v_stats,
    'achievements_earned',v_achievements_count,
    'recent_quizzes',v_recent_quizzes
  );
END;
$$;

-- Multiplayer state-changing RPCs must be caller-bound.
CREATE OR REPLACE FUNCTION public.multiplayer_start_game(p_room_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.multiplayer_rooms%ROWTYPE;
  v_player_count integer;
  v_question_count integer;
  v_inserted_count integer;
BEGIN
  SELECT * INTO v_room FROM public.multiplayer_rooms WHERE id=p_room_id FOR UPDATE;
  IF v_room.id IS NULL OR v_room.host_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the room host can start the game';
  END IF;
  IF v_room.status NOT IN ('waiting','ready') THEN
    RAISE EXCEPTION 'Room is not ready to start';
  END IF;

  SELECT count(*) INTO v_player_count FROM public.room_players WHERE room_id=p_room_id;
  IF v_player_count < 2 THEN
    RAISE EXCEPTION 'At least two players are required';
  END IF;

  DELETE FROM public.room_questions WHERE room_id=p_room_id;

  INSERT INTO public.room_questions(room_id,question_id,order_index)
  SELECT p_room_id,q.id,row_number() OVER (ORDER BY random())-1
  FROM public.questions q
  JOIN public.quizzes qz ON q.quiz_id=qz.id
  WHERE qz.is_approved=true
    AND (v_room.subject IS NULL OR qz.subject=v_room.subject)
    AND (v_room.difficulty IS NULL OR qz.difficulty=v_room.difficulty)
  ORDER BY random()
  LIMIT least(greatest(coalesce(v_room.question_count,10),1),20);

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  IF v_inserted_count < 1 THEN
    RAISE EXCEPTION 'No approved questions are available for this match';
  END IF;

  INSERT INTO public.room_state(room_id,status,question_index)
  VALUES(p_room_id,'countdown',0)
  ON CONFLICT(room_id) DO UPDATE SET
    status='countdown',question_index=0,current_question_id=NULL,
    question_started_at=NULL,question_ends_at=now()+interval '5 seconds',updated_at=now();

  UPDATE public.multiplayer_rooms
  SET status='playing',started_at=now()
  WHERE id=p_room_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.multiplayer_next_question(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.multiplayer_rooms%ROWTYPE;
  v_state public.room_state%ROWTYPE;
  v_next_question_id uuid;
  v_question_data jsonb;
  v_total_questions integer;
BEGIN
  SELECT * INTO v_room FROM public.multiplayer_rooms WHERE id=p_room_id;
  IF v_room.id IS NULL OR v_room.host_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the room host can advance the match';
  END IF;

  SELECT * INTO v_state FROM public.room_state WHERE room_id=p_room_id FOR UPDATE;
  IF v_state.room_id IS NULL THEN
    RAISE EXCEPTION 'Room state not found';
  END IF;
  IF v_state.status NOT IN ('countdown','playing') THEN
    RAISE EXCEPTION 'Match is not active';
  END IF;

  SELECT count(*) INTO v_total_questions FROM public.room_questions WHERE room_id=p_room_id;
  IF v_total_questions = 0 THEN
    RAISE EXCEPTION 'No questions are assigned to this match';
  END IF;

  IF v_state.question_index >= v_total_questions THEN
    UPDATE public.room_state SET status='finished',updated_at=now() WHERE room_id=p_room_id;
    UPDATE public.multiplayer_rooms SET status='finished',finished_at=now() WHERE id=p_room_id;
    RETURN jsonb_build_object('status','finished');
  END IF;

  SELECT rq.question_id INTO v_next_question_id
  FROM public.room_questions rq
  WHERE rq.room_id=p_room_id AND rq.order_index=v_state.question_index;

  IF v_next_question_id IS NULL THEN
    RAISE EXCEPTION 'Next question is unavailable';
  END IF;

  SELECT jsonb_build_object(
    'id',q.id,'question_text',q.question_text,'options',q.options,'points',q.points
  ) INTO v_question_data
  FROM public.questions q WHERE q.id=v_next_question_id;

  IF v_question_data IS NULL THEN
    RAISE EXCEPTION 'Question data is unavailable';
  END IF;

  UPDATE public.room_state SET
    status='playing',
    current_question_id=v_next_question_id,
    question_started_at=now(),
    question_ends_at=now()+interval '30 seconds',
    updated_at=now()
  WHERE room_id=p_room_id;

  RETURN jsonb_build_object(
    'status','playing',
    'question',v_question_data,
    'question_index',v_state.question_index,
    'total_questions',v_total_questions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.multiplayer_submit_answer(
  p_room_id uuid,p_question_id uuid,p_answer text,p_time_used integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state public.room_state%ROWTYPE;
  v_correct_answer text;
  v_is_correct boolean;
  v_points integer;
  v_base_points integer;
  v_effective_time integer;
  v_inserted boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.room_players
    WHERE room_id=p_room_id AND user_id=auth.uid()
  ) THEN
    RAISE EXCEPTION 'You are not in this room';
  END IF;

  SELECT * INTO v_state FROM public.room_state WHERE room_id=p_room_id;
  IF v_state.room_id IS NULL OR v_state.status <> 'playing' THEN
    RAISE EXCEPTION 'The game is not accepting answers';
  END IF;
  IF v_state.current_question_id IS DISTINCT FROM p_question_id THEN
    RAISE EXCEPTION 'This question is not currently active';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.room_questions
    WHERE room_id=p_room_id AND question_id=p_question_id
  ) THEN
    RAISE EXCEPTION 'Question does not belong to this room';
  END IF;

  v_effective_time := greatest(0,least(coalesce(p_time_used,30),30));
  IF v_state.question_ends_at IS NOT NULL AND now() > v_state.question_ends_at THEN
    v_effective_time := 30;
  END IF;

  SELECT correct_answer,coalesce(points,10)
    INTO v_correct_answer,v_base_points
  FROM public.questions WHERE id=p_question_id;
  IF v_correct_answer IS NULL THEN
    RAISE EXCEPTION 'Question answer key is unavailable';
  END IF;

  v_is_correct := p_answer=v_correct_answer;
  v_points := CASE
    WHEN v_is_correct THEN v_base_points + greatest(0,(30-v_effective_time)*2)
    ELSE 0
  END;

  INSERT INTO public.room_answers(
    room_id,user_id,question_id,answer,time_used,is_correct,points
  )
  VALUES(
    p_room_id,auth.uid(),p_question_id,p_answer,v_effective_time,v_is_correct,v_points
  )
  ON CONFLICT(room_id,user_id,question_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT is_correct,points INTO v_is_correct,v_points
    FROM public.room_answers
    WHERE room_id=p_room_id AND user_id=auth.uid() AND question_id=p_question_id;
  ELSE
    UPDATE public.room_players
    SET score=score+v_points
    WHERE room_id=p_room_id AND user_id=auth.uid();
  END IF;

  RETURN jsonb_build_object(
    'is_correct',v_is_correct,
    'points',v_points,
    'correct_answer',v_correct_answer
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_multiplayer_invite(p_invite_id uuid,p_response text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.multiplayer_invites%ROWTYPE;
  v_player_count integer;
  v_max_players integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF lower(trim(p_response)) NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'Invalid response';
  END IF;

  SELECT * INTO v_invite
  FROM public.multiplayer_invites
  WHERE id=p_invite_id AND receiver_id=auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found or not addressed to you'; END IF;
  IF v_invite.status <> 'pending' THEN RAISE EXCEPTION 'Invite already responded to'; END IF;
  IF v_invite.expires_at < now() THEN
    UPDATE public.multiplayer_invites SET status='expired',responded_at=now() WHERE id=p_invite_id;
    RETURN jsonb_build_object('status','expired');
  END IF;

  IF lower(trim(p_response))='accepted' THEN
    SELECT count(*),coalesce(max(mr.max_players),4)
      INTO v_player_count,v_max_players
    FROM public.room_players rp
    RIGHT JOIN public.multiplayer_rooms mr ON mr.id=v_invite.room_id
    WHERE mr.id=v_invite.room_id;

    IF v_player_count >= v_max_players THEN
      RAISE EXCEPTION 'Room is full';
    END IF;

    INSERT INTO public.room_players(room_id,user_id,is_ready)
    VALUES(v_invite.room_id,auth.uid(),true)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.multiplayer_invites
  SET status=lower(trim(p_response)),responded_at=now()
  WHERE id=p_invite_id;

  RETURN jsonb_build_object('status',lower(trim(p_response)),'room_id',v_invite.room_id);
END;
$$;

-- Lock down helper functions that are not intended as public client APIs.
REVOKE ALL ON FUNCTION public.find_student_by_username(text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.update_analytics(uuid,text,integer,integer,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_user_streak(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_achievements(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_match(uuid) FROM PUBLIC, authenticated;

-- Keep legitimate authenticated APIs available.
GRANT EXECUTE ON FUNCTION public.update_analytics(uuid,text,integer,integer,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_streak(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_achievements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_start_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_next_question(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_submit_answer(uuid,uuid,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_multiplayer_invite(uuid,text) TO authenticated;
