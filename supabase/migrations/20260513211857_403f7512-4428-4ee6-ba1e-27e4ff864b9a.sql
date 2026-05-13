-- Remove public SELECT policy on access_codes; only admins/managers can read; redemption goes through edge function with service role
DROP POLICY IF EXISTS "Anyone can check code validity" ON public.access_codes;

-- Mark legacy seeded privileged codes as used so even if re-exposed they are unusable
UPDATE public.access_codes
SET is_used = true
WHERE code IN ('TEACHER2024','ADMIN2024','TEACHER123','ADMIN456','MANAGER789')
  AND is_used = false;