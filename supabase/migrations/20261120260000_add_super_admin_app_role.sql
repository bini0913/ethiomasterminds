-- Introduce a distinct school-network Super Admin role.
-- Keep this enum change isolated so later migrations can safely reference it.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
