-- Keep minor and KG–Grade 4 profile privacy under a verified guardian's control.
-- This migration intentionally fails closed for early-grade accounts, including
-- accounts whose age is missing or was self-reported as 18+.

DROP POLICY IF EXISTS "Users can manage own privacy settings"
  ON public.profile_privacy_settings;
DROP POLICY IF EXISTS "Users can view own privacy settings"
  ON public.profile_privacy_settings;
DROP POLICY IF EXISTS "Non-minor users can manage own privacy settings"
  ON public.profile_privacy_settings;
DROP POLICY IF EXISTS "Users can read privacy settings"
  ON public.profile_privacy_settings;

CREATE POLICY "Users can view own privacy settings"
  ON public.profile_privacy_settings
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Non-minor users can manage own privacy settings"
  ON public.profile_privacy_settings
  FOR ALL TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND NOT (
          coalesce(p.age < 18, false)
          OR lower(coalesce(p.education_level, '')) IN ('early', 'kg', 'kindergarten')
          OR lower(coalesce(p.grade, '')) ~ '^(k|kg|kindergarten|grade[ ]?[0-4]|[0-4])$'
        )
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND NOT (
          coalesce(p.age < 18, false)
          OR lower(coalesce(p.education_level, '')) IN ('early', 'kg', 'kindergarten')
          OR lower(coalesce(p.grade, '')) ~ '^(k|kg|kindergarten|grade[ ]?[0-4]|[0-4])$'
        )
    )
  );

-- Social RLS policies previously queried the privacy table directly and used
-- COALESCE(..., true). Replace that dependency before removing global reads.
CREATE OR REPLACE FUNCTION public.is_profile_public(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce((
    SELECT CASE
      WHEN coalesce(p.age < 18, false)
        OR lower(coalesce(p.education_level, '')) IN ('early', 'kg', 'kindergarten')
        OR lower(coalesce(p.grade, '')) ~ '^(k|kg|kindergarten|grade[ ]?[0-4]|[0-4])$'
      THEN EXISTS (
        SELECT 1
        FROM public.guardian_child_controls controls
        WHERE controls.child_id = p.id
          AND controls.guardian_user_id = p.guardian_user_id
          AND p.guardian_consent = true
          AND p.guardian_consent_status = 'verified'
          AND controls.social_enabled = true
          AND controls.profile_public = true
      )
      ELSE coalesce(privacy.is_public, true)
    END
    FROM public.profiles p
    LEFT JOIN public.profile_privacy_settings privacy ON privacy.user_id = p.id
    WHERE p.id = p_user_id
  ), false);
$$;
REVOKE ALL ON FUNCTION public.is_profile_public(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_profile_public(uuid) TO authenticated;

-- Apply the same guardian-aware visibility rule to every SECURITY DEFINER
-- profile projection, not just the early-specific leaderboard and social RLS.
CREATE OR REPLACE FUNCTION public.get_student_leaderboard()
RETURNS TABLE (
  id uuid, name text, username text, avatar text, avatar_config jsonb, grade integer,
  xp integer, season_xp integer, level integer, rank text, badges text[], streak integer,
  accuracy numeric, matches_played integer, wins integer, losses integer, contributions integer,
  weekly_score integer, monthly_score integer, total_xp integer, coins integer, active_title text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  WITH attempt_stats AS (
    SELECT qa.user_id,
      count(*) FILTER (WHERE qa.created_at >= now()-interval '7 days')::integer weekly_attempts,
      count(*) FILTER (WHERE qa.created_at >= now()-interval '7 days' AND qa.is_correct)::integer weekly_correct,
      count(*) FILTER (WHERE qa.created_at >= now()-interval '30 days')::integer monthly_attempts,
      count(*) FILTER (WHERE qa.created_at >= now()-interval '30 days' AND qa.is_correct)::integer monthly_correct
    FROM public.question_attempts qa
    WHERE qa.created_at >= now()-interval '30 days'
    GROUP BY qa.user_id
  )
  SELECT p.id,
    coalesce(nullif(trim(p.name),''),nullif(trim(p.username),''),'Learner')::text,
    coalesce(nullif(trim(p.username),''),nullif(trim(p.name),''),'learner')::text,
    p.avatar,p.avatar_config,
    CASE WHEN lower(trim(coalesce(p.grade,''))) IN ('k','kg','kindergarten') THEN 0
      ELSE nullif(regexp_replace(coalesce(p.grade,''),'[^0-9]','','g'),'')::integer END,
    coalesce(p.xp,0)::integer,coalesce(p.season_xp,p.xp,0)::integer,coalesce(p.level,1)::integer,
    p.rank,coalesce(p.badges,ARRAY[]::text[]),coalesce(us.current_streak,0)::integer,
    CASE WHEN coalesce(a.monthly_attempts,0)>0 THEN round((a.monthly_correct::numeric/a.monthly_attempts)*100,1) ELSE 0::numeric END,
    coalesce(m.matches_played,0)::integer,coalesce(m.wins,0)::integer,
    greatest(coalesce(m.matches_played,0)-coalesce(m.wins,0),0)::integer,0::integer,
    (coalesce(a.weekly_attempts,0)*10+coalesce(a.weekly_correct,0)*5)::integer,
    (coalesce(a.monthly_attempts,0)*10+coalesce(a.monthly_correct,0)*5)::integer,
    coalesce(p.xp,0)::integer,0::integer,NULL::text
  FROM public.profiles p
  LEFT JOIN public.profile_privacy_settings privacy ON privacy.user_id = p.id
  LEFT JOIN attempt_stats a ON a.user_id=p.id
  LEFT JOIN public.user_streaks us ON us.user_id=p.id
  LEFT JOIN public.multiplayer_ranked_stats m ON m.user_id=p.id
  WHERE auth.uid() IS NOT NULL
    AND public.is_profile_public(p.id)
    AND NOT coalesce(privacy.hide_stats, false)
  ORDER BY coalesce(p.season_xp,p.xp,0) DESC,p.id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_leaderboard(_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, name text, username text, xp integer, level integer, avatar text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p.id,p.name,p.username,p.xp,p.level,p.avatar
  FROM public.profiles p
  LEFT JOIN public.profile_privacy_settings privacy ON privacy.user_id=p.id
  WHERE auth.uid() IS NOT NULL
    AND public.is_profile_public(p.id)
    AND NOT coalesce(privacy.hide_stats,false)
  ORDER BY p.xp DESC NULLS LAST,p.created_at ASC
  LIMIT greatest(1,least(coalesce(_limit,50),100));
$$;

CREATE OR REPLACE FUNCTION public.get_public_student_profiles(p_user_ids uuid[])
RETURNS TABLE(id uuid,name text,username text,avatar text,level integer,xp integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p.id,p.name,p.username,p.avatar,p.level,p.xp
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id=p.id AND ur.role='student'
  LEFT JOIN public.profile_privacy_settings privacy ON privacy.user_id=p.id
  WHERE auth.uid() IS NOT NULL
    AND p.id=ANY(coalesce(p_user_ids,'{}'::uuid[]))
    AND public.is_profile_public(p.id)
    AND NOT coalesce(privacy.hide_stats,false);
$$;

CREATE OR REPLACE FUNCTION public.multiplayer_ranked_leaderboard(p_limit integer DEFAULT 100)
RETURNS TABLE(
  user_id uuid,
  player_name text,
  total_points bigint,
  matches_played integer,
  wins integer,
  podiums integer,
  rank_position bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
  SELECT
    s.user_id,
    coalesce(p.name, p.username, 'Player') AS player_name,
    s.total_points,
    s.matches_played,
    s.wins,
    s.podiums,
    row_number() OVER (
      ORDER BY s.total_points DESC, s.wins DESC, s.updated_at ASC
    ) AS rank_position
  FROM public.multiplayer_ranked_stats s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN public.profile_privacy_settings privacy ON privacy.user_id = p.id
  WHERE auth.uid() IS NOT NULL
    AND public.is_profile_public(s.user_id)
    AND NOT coalesce(privacy.hide_stats, false)
  ORDER BY s.total_points DESC, s.wins DESC, s.updated_at ASC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 100));
$$;

REVOKE ALL ON FUNCTION public.get_student_leaderboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_leaderboard() TO authenticated;
REVOKE ALL ON FUNCTION public.get_public_leaderboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_leaderboard(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.get_public_student_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_student_profiles(uuid[]) TO authenticated;

ALTER POLICY "Authenticated users can view opted-in posts"
  ON public.social_posts
  USING (
    public.is_current_user_feature_enabled('social')
    AND (
      author_id = (SELECT auth.uid())
      OR (NOT public.is_blocked_with(author_id) AND public.is_profile_public(author_id))
    )
  );

ALTER POLICY "authenticated can view visible post likes"
  ON public.social_post_likes
  USING (EXISTS (
    SELECT 1 FROM public.social_posts p
    WHERE p.id = social_post_likes.post_id
      AND (p.author_id = (SELECT auth.uid()) OR public.is_profile_public(p.author_id))
  ));
ALTER POLICY "users can like visible posts"
  ON public.social_post_likes
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.has_accepted_policy('community_terms', '2026-11-24')
    AND public.is_current_user_feature_enabled('social')
    AND EXISTS (
      SELECT 1 FROM public.social_posts p
      WHERE p.id = social_post_likes.post_id
        AND NOT public.is_blocked_with(p.author_id)
        AND (p.author_id = (SELECT auth.uid()) OR public.is_profile_public(p.author_id))
    )
  );

ALTER POLICY "authenticated can view visible post reactions"
  ON public.social_post_reactions
  USING (EXISTS (
    SELECT 1 FROM public.social_posts p
    WHERE p.id = social_post_reactions.post_id
      AND (p.author_id = (SELECT auth.uid()) OR public.is_profile_public(p.author_id))
  ));
ALTER POLICY "users can react to visible posts"
  ON public.social_post_reactions
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.has_accepted_policy('community_terms', '2026-11-24')
    AND public.is_current_user_feature_enabled('social')
    AND EXISTS (
      SELECT 1 FROM public.social_posts p
      WHERE p.id = social_post_reactions.post_id
        AND NOT public.is_blocked_with(p.author_id)
        AND (p.author_id = (SELECT auth.uid()) OR public.is_profile_public(p.author_id))
    )
  );

ALTER POLICY "authenticated can view visible post comments"
  ON public.social_post_comments
  USING (
    public.is_current_user_feature_enabled('social')
    AND NOT public.is_blocked_with(user_id)
    AND EXISTS (
      SELECT 1 FROM public.social_posts p
      WHERE p.id = social_post_comments.post_id
        AND (p.author_id = (SELECT auth.uid()) OR public.is_profile_public(p.author_id))
    )
  );
ALTER POLICY "users can comment on visible posts"
  ON public.social_post_comments
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.has_accepted_policy('community_terms', '2026-11-24')
    AND public.is_current_user_feature_enabled('social')
    AND EXISTS (
      SELECT 1 FROM public.social_posts p
      WHERE p.id = social_post_comments.post_id
        AND NOT public.is_blocked_with(p.author_id)
        AND (p.author_id = (SELECT auth.uid()) OR public.is_profile_public(p.author_id))
    )
  );

ALTER POLICY "users can save visible posts"
  ON public.saved_posts
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_current_user_feature_enabled('social')
    AND EXISTS (
      SELECT 1 FROM public.social_posts p
      WHERE p.id = saved_posts.post_id
        AND (p.author_id = (SELECT auth.uid()) OR public.is_profile_public(p.author_id))
    )
  );

-- Backfill a private row for every minor/early learner. Several legacy consumers
-- use COALESCE(is_public, true), so an absent row must not imply public access.
INSERT INTO public.profile_privacy_settings (
  user_id, is_public, show_online_status, allow_friend_requests, allow_messages, updated_at
)
SELECT p.id, false, false, false, false, now()
FROM public.profiles p
WHERE coalesce(p.age < 18, false)
   OR lower(coalesce(p.education_level, '')) IN ('early', 'kg', 'kindergarten')
   OR lower(coalesce(p.grade, '')) ~ '^(k|kg|kindergarten|grade[ ]?[0-4]|[0-4])$'
ON CONFLICT (user_id) DO NOTHING;

-- Reconcile existing child settings against the verified guardian control row.
-- Learner-set public/friend/message flags are not retained; only matching,
-- verified guardian settings can authorize those capabilities.
UPDATE public.profile_privacy_settings s
SET is_public = coalesce(c.social_enabled AND c.profile_public, false),
    allow_friend_requests = coalesce(c.social_enabled AND c.friend_requests_enabled, false),
    allow_messages = coalesce(c.social_enabled AND c.direct_messages_enabled, false),
    show_online_status = false,
    updated_at = now()
FROM public.profiles p
LEFT JOIN public.guardian_child_controls c
  ON c.child_id = p.id
 AND c.guardian_user_id = p.guardian_user_id
 AND p.guardian_consent = true
 AND p.guardian_consent_status = 'verified'
WHERE s.user_id = p.id
  AND (
    coalesce(p.age < 18, false)
    OR lower(coalesce(p.education_level, '')) IN ('early', 'kg', 'kindergarten')
    OR lower(coalesce(p.grade, '')) ~ '^(k|kg|kindergarten|grade[ ]?[0-4]|[0-4])$'
  );

-- Enforce private defaults for new or reclassified early learners even when age
-- is NULL. Preserve only controls that are linked to the currently verified
-- guardian. SECURITY DEFINER is required because this trigger writes the private
-- privacy row; callers cannot execute the trigger function directly.
CREATE OR REPLACE FUNCTION public.apply_minor_private_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_controls public.guardian_child_controls%rowtype;
  v_is_minor_or_early boolean;
BEGIN
  v_is_minor_or_early :=
    coalesce(NEW.age < 18, false)
    OR lower(coalesce(NEW.education_level, '')) IN ('early', 'kg', 'kindergarten')
    OR lower(coalesce(NEW.grade, '')) ~ '^(k|kg|kindergarten|grade[ ]?[0-4]|[0-4])$';

  IF NOT v_is_minor_or_early THEN
    RETURN NEW;
  END IF;

  SELECT c.* INTO v_controls
  FROM public.guardian_child_controls c
  WHERE c.child_id = NEW.id
    AND c.guardian_user_id = NEW.guardian_user_id
    AND NEW.guardian_consent = true
    AND NEW.guardian_consent_status = 'verified';

  INSERT INTO public.profile_privacy_settings (
    user_id, is_public, show_online_status, allow_friend_requests, allow_messages, updated_at
  ) VALUES (
    NEW.id,
    coalesce(v_controls.social_enabled AND v_controls.profile_public, false),
    false,
    coalesce(v_controls.social_enabled AND v_controls.friend_requests_enabled, false),
    coalesce(v_controls.social_enabled AND v_controls.direct_messages_enabled, false),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    is_public = EXCLUDED.is_public,
    show_online_status = false,
    allow_friend_requests = EXCLUDED.allow_friend_requests,
    allow_messages = EXCLUDED.allow_messages,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_minor_private_defaults ON public.profiles;
CREATE TRIGGER profiles_minor_private_defaults
  AFTER INSERT OR UPDATE OF age, grade, education_level, guardian_consent,
    guardian_consent_status, guardian_user_id
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.apply_minor_private_defaults();
REVOKE ALL ON FUNCTION public.apply_minor_private_defaults() FROM PUBLIC, anon, authenticated;

-- A child appears on an early leaderboard only when their verified guardian has
-- explicitly enabled both social access and profile visibility. Missing privacy
-- rows and self-reported adult ages never make an early learner public by default.
CREATE OR REPLACE FUNCTION public.get_early_leaderboard(
  p_scope text DEFAULT 'grade',
  p_period text DEFAULT 'all',
  p_category text DEFAULT 'overall'
)
RETURNS TABLE(username text, avatar text, level integer, score integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(nullif(p.username, ''), 'Learner') AS username,
    coalesce(p.avatar, 'avatar-1') AS avatar,
    coalesce(p.level, 1) AS level,
    CASE WHEN p_category = 'discover'
      THEN coalesce((SELECT count(*) FROM public.early_item_exposure e WHERE e.user_id = p.id), 0)
      ELSE coalesce(p.season_xp, p.xp, 0) END AS score
  FROM public.profiles p
  LEFT JOIN public.profile_privacy_settings privacy ON privacy.user_id = p.id
  WHERE auth.uid() IS NOT NULL
    AND (
      lower(coalesce(p.education_level, '')) IN ('early', 'kg', 'kindergarten')
      OR lower(coalesce(p.grade, '')) ~ '^(k|kg|kindergarten|grade[ ]?[0-4]|[0-4])$'
    )
    AND NOT coalesce(privacy.hide_stats, false)
    AND EXISTS (
      SELECT 1
      FROM public.guardian_child_controls controls
      WHERE controls.child_id = p.id
        AND controls.guardian_user_id = p.guardian_user_id
        AND p.guardian_consent = true
        AND p.guardian_consent_status = 'verified'
        AND controls.social_enabled = true
        AND controls.profile_public = true
    )
  ORDER BY score DESC, username ASC
  LIMIT 50;
$$;
