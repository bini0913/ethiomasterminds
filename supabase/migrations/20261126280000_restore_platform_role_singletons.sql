-- Restore the two role-specific singleton constraints removed by the
-- duplicate-index cleanup migration. The per-account authority constraint
-- remains separately defined by user_roles_one_platform_role_per_account_idx.
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_extreme_admin_idx
  ON public.user_roles (role)
  WHERE role = 'extreme_admin'::public.app_role;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_super_admin_idx
  ON public.user_roles (role)
  WHERE role = 'super_admin'::public.app_role;
