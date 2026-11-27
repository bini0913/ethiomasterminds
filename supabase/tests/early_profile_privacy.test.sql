BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(13);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_privacy_settings'
      AND policyname = 'Users can manage own privacy settings'
  ),
  'the unrestricted owner-manage privacy policy is removed'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_privacy_settings'
      AND policyname = 'Users can read privacy settings'
  ),
  'private privacy-setting rows are no longer globally readable'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.is_profile_public(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.is_profile_public(uuid)', 'EXECUTE')
  AND position('guardian_child_controls' in lower(pg_get_functiondef('public.is_profile_public(uuid)'::regprocedure))) > 0,
  'social visibility uses an authenticated-only, guardian-aware helper'
);

SELECT ok(
  (SELECT count(*) = 8
   FROM pg_policies
   WHERE schemaname = 'public'
     AND policyname IN (
       'Authenticated users can view opted-in posts',
       'authenticated can view visible post likes',
       'users can like visible posts',
       'authenticated can view visible post reactions',
       'users can react to visible posts',
       'authenticated can view visible post comments',
       'users can comment on visible posts',
       'users can save visible posts'
     )
     AND position('is_profile_public' in lower(coalesce(qual, '') || ' ' || coalesce(with_check, ''))) > 0),
  'all social visibility RLS paths use the guardian-aware helper'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_privacy_settings'
      AND policyname = 'Users can view own privacy settings'
      AND cmd = 'SELECT'
  ),
  'learners can still read their own privacy settings'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_privacy_settings'
      AND policyname = 'Non-minor users can manage own privacy settings'
      AND cmd = 'ALL'
  ),
  'self-service privacy writes have a separate restrictive policy'
);

SELECT ok(
  position('age' in lower(with_check)) > 0
  AND position('education_level' in lower(with_check)) > 0
  AND position('grade' in lower(with_check)) > 0,
  'self-service privacy writes explicitly exclude minors and early grades'
)
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profile_privacy_settings'
  AND policyname = 'Non-minor users can manage own privacy settings';

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass
      AND tgname = 'profiles_minor_private_defaults'
      AND NOT tgisinternal
  ),
  'private defaults are enforced when profiles are created or reclassified'
);

SELECT ok(
  position('guardian_child_controls' in lower(pg_get_functiondef('public.apply_minor_private_defaults()'::regprocedure))) > 0
  AND position('education_level' in lower(pg_get_functiondef('public.apply_minor_private_defaults()'::regprocedure))) > 0
  AND position('grade' in lower(pg_get_functiondef('public.apply_minor_private_defaults()'::regprocedure))) > 0,
  'private defaults include KG–Grade 4 accounts and preserve only verified guardian controls'
);

SELECT ok(
  position('guardian_child_controls' in lower(pg_get_functiondef('public.get_early_leaderboard(text,text,text)'::regprocedure))) > 0
  AND position('guardian_consent_status' in lower(pg_get_functiondef('public.get_early_leaderboard(text,text,text)'::regprocedure))) > 0
  AND position('profile_public' in lower(pg_get_functiondef('public.get_early_leaderboard(text,text,text)'::regprocedure))) > 0
  AND position('social_enabled' in lower(pg_get_functiondef('public.get_early_leaderboard(text,text,text)'::regprocedure))) > 0,
  'the early leaderboard requires verified guardian-approved social and public-profile access'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.get_early_leaderboard(text,text,text)', 'EXECUTE'),
  'authenticated learners can still call the privacy-filtered early leaderboard'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_early_leaderboard(text,text,text)', 'EXECUTE'),
  'anonymous users cannot call the early leaderboard'
);

SELECT ok(
  position('is_profile_public' in lower(pg_get_functiondef('public.get_student_leaderboard()'::regprocedure))) > 0
  AND position('is_profile_public' in lower(pg_get_functiondef('public.get_public_leaderboard(integer)'::regprocedure))) > 0
  AND position('is_profile_public' in lower(pg_get_functiondef('public.get_public_student_profiles(uuid[])'::regprocedure))) > 0
  AND position('is_profile_public' in lower(pg_get_functiondef('public.multiplayer_ranked_leaderboard(integer)'::regprocedure))) > 0,
  'all profile projection RPCs use the guardian-aware visibility helper'
);

SELECT * FROM finish();
ROLLBACK;
