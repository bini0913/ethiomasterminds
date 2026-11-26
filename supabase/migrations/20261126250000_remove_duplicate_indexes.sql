-- Remove exact duplicate indexes. Keep the unique indexes that provide
-- identical lookup coverage and preserve the single-admin invariants.
drop index if exists public.user_policy_acceptances_lookup_idx;
drop index if exists public.user_roles_single_super_admin_idx;
drop index if exists public.user_roles_single_extreme_admin_idx;
