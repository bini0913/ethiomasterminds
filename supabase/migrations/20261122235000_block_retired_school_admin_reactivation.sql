-- Prevent suspended legacy School Admin memberships and ended Main Director
-- appointments from being reactivated through generic manager update paths.
BEGIN;

CREATE OR REPLACE FUNCTION public.school_reject_retired_admin_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.school_role = 'admin'
     AND (TG_OP = 'INSERT' OR NEW.status = 'active') THEN
    RAISE EXCEPTION 'The School Admin membership is retired. Use the School Manager and leadership appointment workflow.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS school_reject_retired_admin_membership ON public.school_memberships;
CREATE TRIGGER school_reject_retired_admin_membership
BEFORE INSERT OR UPDATE ON public.school_memberships
FOR EACH ROW EXECUTE FUNCTION public.school_reject_retired_admin_membership();

CREATE OR REPLACE FUNCTION public.school_reject_retired_main_director_appointment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.position = 'main_director'
     AND (TG_OP = 'INSERT' OR NEW.status = 'active') THEN
    RAISE EXCEPTION 'The Main Director designation is retired. Appoint a supported Director or school-wide Director instead.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS school_reject_retired_main_director_appointment ON public.school_leadership_appointments;
CREATE TRIGGER school_reject_retired_main_director_appointment
BEFORE INSERT OR UPDATE ON public.school_leadership_appointments
FOR EACH ROW EXECUTE FUNCTION public.school_reject_retired_main_director_appointment();

COMMIT;
