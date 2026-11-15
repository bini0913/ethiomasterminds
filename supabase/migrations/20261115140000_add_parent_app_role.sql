-- Add the dedicated parent role. Parent accounts are independent accounts,
-- not a student account switched into a parent-view mode.
DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$$;
