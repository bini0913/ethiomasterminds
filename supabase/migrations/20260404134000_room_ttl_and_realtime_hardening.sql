-- Auto-clean multiplayer rooms older than 1 hour and expose a callable cleanup RPC

CREATE OR REPLACE FUNCTION public.cleanup_expired_multiplayer_rooms()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  WITH deleted AS (
    DELETE FROM public.multiplayer_rooms
    WHERE created_at <= now() - interval '1 hour'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  RETURN v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_multiplayer_rooms() TO authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_expired_multiplayer_rooms_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.cleanup_expired_multiplayer_rooms();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_expired_multiplayer_rooms ON public.multiplayer_rooms;

CREATE TRIGGER trg_cleanup_expired_multiplayer_rooms
BEFORE INSERT OR UPDATE ON public.multiplayer_rooms
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_expired_multiplayer_rooms_trigger();
