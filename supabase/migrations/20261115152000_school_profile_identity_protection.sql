-- School-managed usernames and grades are controlled by the school enrollment,
-- not by a student editing their general profile.
CREATE OR REPLACE FUNCTION public.school_protect_managed_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_school_membership boolean;
  v_is_school_student boolean;
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM public.school_memberships membership WHERE membership.user_id = OLD.id),
    EXISTS (
      SELECT 1 FROM public.school_memberships membership
      WHERE membership.user_id = OLD.id AND membership.school_role = 'student'
    )
  INTO v_has_school_membership, v_is_school_student;

  IF v_has_school_membership AND NEW.username IS DISTINCT FROM OLD.username THEN
    RAISE EXCEPTION 'School-managed usernames cannot be changed from the profile editor';
  END IF;

  IF v_is_school_student
     AND NEW.grade IS DISTINCT FROM OLD.grade
     AND coalesce(current_setting('app.school_profile_sync', true), '') <> 'true' THEN
    RAISE EXCEPTION 'School-managed grade changes must be made through school enrollment';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_protect_managed_profile_fields ON public.profiles;
CREATE TRIGGER school_protect_managed_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.school_protect_managed_profile_fields();

CREATE OR REPLACE FUNCTION public.school_sync_profile_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.school_role = 'student'
     AND NEW.grade_label IS DISTINCT FROM OLD.grade_label THEN
    PERFORM set_config('app.school_profile_sync', 'true', true);
    UPDATE public.profiles
    SET grade = NEW.grade_label
    WHERE id = NEW.user_id;
    PERFORM set_config('app.school_profile_sync', '', true);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_sync_profile_grade ON public.school_memberships;
CREATE TRIGGER school_sync_profile_grade
AFTER UPDATE OF grade_label ON public.school_memberships
FOR EACH ROW EXECUTE FUNCTION public.school_sync_profile_grade();

REVOKE ALL ON FUNCTION public.school_protect_managed_profile_fields() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_sync_profile_grade() FROM PUBLIC, anon, authenticated;
