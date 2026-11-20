-- Make administrator wallet adjustments and their audit entries one transaction.
-- The legacy two-argument RPC remains callable, but now creates an audit row too.

CREATE OR REPLACE FUNCTION public.admin_adjust_coins_with_audit(
  p_user_identifier text,
  p_amount integer,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_coins integer;
  v_reason text;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'extreme_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Coin adjustment must be a non-zero integer';
  END IF;

  v_reason := trim(coalesce(p_reason, ''));
  IF length(v_reason) < 8 OR length(v_reason) > 500 THEN
    RAISE EXCEPTION 'Reason must contain between 8 and 500 characters';
  END IF;

  v_uid := public._resolve_user_identifier(p_user_identifier);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO public.user_currency AS current_currency (user_id, coins)
  VALUES (v_uid, GREATEST(0, p_amount))
  ON CONFLICT (user_id) DO UPDATE
    SET coins = GREATEST(0, current_currency.coins + p_amount),
        updated_at = now()
  RETURNING coins INTO v_coins;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    'admin_adjust_coins',
    'user',
    v_uid,
    jsonb_build_object(
      'amount', p_amount,
      'resulting_coins', v_coins,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object('user_id', v_uid, 'coins', v_coins);
END;
$$;

-- Keep the established function signature available for any older client, while
-- ensuring even calls that cannot supply a reason are audited atomically.
CREATE OR REPLACE FUNCTION public.admin_adjust_coins(p_user_identifier text, p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'extreme_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN public.admin_adjust_coins_with_audit(
    p_user_identifier,
    p_amount,
    'Legacy wallet adjustment RPC call; no operator reason was supplied.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_coins_with_audit(text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_coins_with_audit(text, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_adjust_coins(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_coins(text, integer) TO authenticated;
