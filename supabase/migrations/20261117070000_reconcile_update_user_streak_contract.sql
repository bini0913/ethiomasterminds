-- Preserve the established update_user_streak RPC contract.
-- The prior reconciliation migration attempted to change this function from
-- jsonb to void, which PostgreSQL rejects during a clean migration reset.
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

  SELECT * INTO v_streak
  FROM public.user_streaks
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_streak IS NULL THEN
    INSERT INTO public.user_streaks(user_id, current_streak, longest_streak, last_activity_date)
    VALUES (p_user_id, 1, 1, v_today)
    RETURNING * INTO v_streak;
  ELSIF v_streak.last_activity_date = v_today THEN
    NULL;
  ELSIF v_streak.last_activity_date = v_yesterday THEN
    UPDATE public.user_streaks
    SET current_streak = current_streak + 1,
        longest_streak = greatest(longest_streak, current_streak + 1),
        last_activity_date = v_today,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO v_streak;
  ELSE
    UPDATE public.user_streaks
    SET current_streak = 1,
        last_activity_date = v_today,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO v_streak;
  END IF;

  RETURN jsonb_build_object(
    'current_streak', coalesce(v_streak.current_streak, 0),
    'longest_streak', coalesce(v_streak.longest_streak, 0),
    'streak_maintained', v_streak.last_activity_date = v_today
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_streak(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_user_streak(uuid) TO authenticated;
