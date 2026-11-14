-- Use the Ethiopian calendar date consistently for daily wallet rewards.
-- The function body uses current_date; a function-local timezone keeps those date
-- comparisons aligned with the app's Africa/Addis_Ababa daily challenge and missions.
ALTER FUNCTION public.wallet_action(text, integer, uuid)
  SET timezone = 'Africa/Addis_Ababa';