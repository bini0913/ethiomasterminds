
-- Update add_xp to auto-credit coins (1 coin per 100 XP)
CREATE OR REPLACE FUNCTION public.add_xp(p_user_id uuid, p_amount integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_xp INTEGER;
  v_new_xp INTEGER;
  v_current_level INTEGER;
  v_new_level INTEGER;
  v_new_rank TEXT;
  v_leveled_up BOOLEAN := false;
  v_coins_to_add INTEGER;
BEGIN
  SELECT xp, level INTO v_current_xp, v_current_level
  FROM profiles WHERE id = p_user_id;

  v_new_xp := COALESCE(v_current_xp,0) + p_amount;
  v_new_level := FLOOR(v_new_xp / 100) + 1;
  v_new_rank := calculate_rank(v_new_xp);
  v_leveled_up := v_new_level > COALESCE(v_current_level,1);

  UPDATE profiles
  SET xp = v_new_xp, level = v_new_level, rank = v_new_rank
  WHERE id = p_user_id;

  -- Auto-credit coins: 1 coin per 100 XP earned (only positive XP)
  IF p_amount > 0 THEN
    v_coins_to_add := FLOOR(p_amount / 100);
    IF v_coins_to_add > 0 THEN
      INSERT INTO user_currency (user_id, coins)
      VALUES (p_user_id, v_coins_to_add)
      ON CONFLICT (user_id) DO UPDATE
      SET coins = user_currency.coins + v_coins_to_add,
          updated_at = now();
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'previous_xp', v_current_xp,
    'new_xp', v_new_xp,
    'xp_gained', p_amount,
    'previous_level', v_current_level,
    'new_level', v_new_level,
    'leveled_up', v_leveled_up,
    'rank', v_new_rank,
    'coins_added', COALESCE(v_coins_to_add,0)
  );
END;
$function$;

-- Helper: resolve user identifier (uuid or username)
CREATE OR REPLACE FUNCTION public._resolve_user_identifier(p_identifier text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  BEGIN
    v_id := p_identifier::uuid;
    IF EXISTS (SELECT 1 FROM profiles WHERE id = v_id) THEN
      RETURN v_id;
    END IF;
  EXCEPTION WHEN others THEN NULL;
  END;
  SELECT id INTO v_id FROM profiles
   WHERE LOWER(username) = LOWER(p_identifier) OR LOWER(name) = LOWER(p_identifier)
   LIMIT 1;
  RETURN v_id;
END;
$$;

-- Admin: adjust XP (positive or negative)
CREATE OR REPLACE FUNCTION public.admin_adjust_xp(p_user_identifier text, p_amount integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE v_uid uuid; v_new_xp integer; v_new_level integer; v_new_rank text;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  v_uid := _resolve_user_identifier(p_user_identifier);
  IF v_uid IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  UPDATE profiles
     SET xp = GREATEST(0, COALESCE(xp,0) + p_amount)
   WHERE id = v_uid
   RETURNING xp INTO v_new_xp;

  v_new_level := GREATEST(1, FLOOR(v_new_xp/100) + 1);
  v_new_rank := calculate_rank(v_new_xp);
  UPDATE profiles SET level = v_new_level, rank = v_new_rank WHERE id = v_uid;

  -- Credit coins if positive
  IF p_amount > 0 THEN
    INSERT INTO user_currency (user_id, coins)
    VALUES (v_uid, FLOOR(p_amount/100))
    ON CONFLICT (user_id) DO UPDATE
      SET coins = user_currency.coins + FLOOR(p_amount/100),
          updated_at = now();
  END IF;

  RETURN jsonb_build_object('user_id', v_uid, 'xp', v_new_xp, 'level', v_new_level, 'rank', v_new_rank);
END;
$$;

-- Admin: set level
CREATE OR REPLACE FUNCTION public.admin_set_user_level(p_user_identifier text, p_level integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE v_uid uuid; v_xp integer;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  v_uid := _resolve_user_identifier(p_user_identifier);
  IF v_uid IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  v_xp := GREATEST(0, (p_level - 1) * 100);
  UPDATE profiles
     SET level = GREATEST(1, p_level), xp = v_xp, rank = calculate_rank(v_xp)
   WHERE id = v_uid;
  RETURN jsonb_build_object('user_id', v_uid, 'level', p_level, 'xp', v_xp);
END;
$$;

-- Admin: adjust coins
CREATE OR REPLACE FUNCTION public.admin_adjust_coins(p_user_identifier text, p_amount integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE v_uid uuid; v_coins integer;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  v_uid := _resolve_user_identifier(p_user_identifier);
  IF v_uid IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  INSERT INTO user_currency (user_id, coins)
  VALUES (v_uid, GREATEST(0, p_amount))
  ON CONFLICT (user_id) DO UPDATE
    SET coins = GREATEST(0, user_currency.coins + p_amount),
        updated_at = now()
  RETURNING coins INTO v_coins;

  RETURN jsonb_build_object('user_id', v_uid, 'coins', v_coins);
END;
$$;

-- Admin: reset user progress (level or full)
CREATE OR REPLACE FUNCTION public.admin_reset_user_progress(p_user_identifier text, p_reset_mode text DEFAULT 'full')
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE v_uid uuid;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  v_uid := _resolve_user_identifier(p_user_identifier);
  IF v_uid IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  IF p_reset_mode = 'level' THEN
    UPDATE profiles SET xp = 0, level = 1, rank = calculate_rank(0) WHERE id = v_uid;
  ELSE
    -- full reset
    UPDATE profiles SET xp = 0, level = 1, rank = calculate_rank(0), badges = '{}' WHERE id = v_uid;
    UPDATE user_currency SET coins = 0, gems = 0, updated_at = now() WHERE user_id = v_uid;
    UPDATE user_streaks SET current_streak = 0, longest_streak = 0, last_activity_date = NULL, updated_at = now() WHERE user_id = v_uid;
    DELETE FROM quiz_results WHERE student_id = v_uid;
    DELETE FROM question_attempts WHERE user_id = v_uid;
    DELETE FROM user_achievements WHERE user_id = v_uid;
    DELETE FROM analytics WHERE user_id = v_uid;
  END IF;

  RETURN jsonb_build_object('user_id', v_uid, 'mode', p_reset_mode, 'reset_at', now());
END;
$$;
