-- Super Admin access layer for existing operational/admin tables.
-- The extreme_admin role is the highest application authority.
-- This migration preserves the existing role-specific policies and adds a
-- permissive root policy so the Super Admin can operate the same admin tools.

DO $$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles','user_roles','quizzes','questions','flashcards',
    'social_posts','study_plans','library_books','reports',
    'announcements','user_presence','quiz_results','book_uploads'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      policy_name := 'extreme admin full control ' || table_name;
      IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = table_name
          AND policyname = policy_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((select public._is_extreme_admin())) WITH CHECK ((select public._is_extreme_admin()))',
          policy_name,
          table_name
        );
      END IF;
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
        table_name
      );
    END IF;
  END LOOP;
END
$$;

-- Keep the root role visible to the application's role lookup.
GRANT EXECUTE ON FUNCTION public._is_extreme_admin() TO authenticated;
