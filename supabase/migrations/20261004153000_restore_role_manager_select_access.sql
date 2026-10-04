-- Restore read access needed by admin/manager control surfaces.
-- This is SELECT-only; the operation-specific INSERT/UPDATE/DELETE
-- hardening from PR #262 remains unchanged.

drop policy if exists "Role managers can view managed roles" on public.user_roles;

create policy "Role managers can view managed roles"
on public.user_roles
for select
to authenticated
using (
  _is_extreme_admin()
  or has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'manager'::app_role)
);