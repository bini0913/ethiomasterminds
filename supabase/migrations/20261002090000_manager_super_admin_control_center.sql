-- Manager + Super Admin control center foundation.
-- Super Admin is stored internally as extreme_admin to preserve the existing app role contract.
-- Private chat inspection is intentionally limited to extreme_admin and is audit logged.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'extreme_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'extreme_admin';
  END IF;
END
$$;

