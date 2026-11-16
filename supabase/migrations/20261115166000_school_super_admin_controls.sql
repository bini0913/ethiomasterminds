-- Allow the platform Super Admin to suspend/reactivate school tenants.
-- The existing Manager policy remains scoped to that Manager's own school.
DROP POLICY IF EXISTS schools_super_admin_update ON public.schools;
CREATE POLICY schools_super_admin_update ON public.schools
FOR UPDATE TO authenticated
USING (public._is_extreme_admin())
WITH CHECK (public._is_extreme_admin());

GRANT UPDATE ON public.schools TO authenticated;
