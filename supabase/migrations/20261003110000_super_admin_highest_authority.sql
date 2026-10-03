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


-- Root control-center backend: one audited RPC surface for the Super Admin.
CREATE OR REPLACE FUNCTION public.extreme_admin_get_system_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public._is_extreme_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  SELECT jsonb_build_object(
    'users',(SELECT count(*) FROM public.profiles),
    'admins',(SELECT count(*) FROM public.user_roles WHERE role='admin'),
    'managers',(SELECT count(*) FROM public.user_roles WHERE role='manager'),
    'teachers',(SELECT count(*) FROM public.user_roles WHERE role='teacher'),
    'students',(SELECT count(*) FROM public.user_roles WHERE role='student'),
    'super_admins',(SELECT count(*) FROM public.user_roles WHERE role='extreme_admin'),
    'reports',(SELECT count(*) FROM public.reports),
    'pending_reports',(SELECT count(*) FROM public.reports WHERE status='pending'),
    'posts',(SELECT count(*) FROM public.social_posts),
    'books',(SELECT count(*) FROM public.library_books),
    'messages',(SELECT count(*) FROM public.messages)
  ) INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.extreme_admin_set_role(
  p_user_id uuid, p_role public.app_role, p_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF NOT public._is_extreme_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  IF p_user_id=auth.uid() AND p_role<>'extreme_admin' THEN RAISE EXCEPTION 'Cannot demote the active Super Admin'; END IF;
  DELETE FROM public.user_roles WHERE user_id=p_user_id;
  INSERT INTO public.user_roles(user_id,role) VALUES(p_user_id,p_role);
  INSERT INTO public.admin_audit_logs(actor_id,action,target_type,target_id,metadata)
  VALUES(auth.uid(),'root_set_role','user',p_user_id,jsonb_build_object('role',p_role,'reason',p_reason));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.extreme_admin_set_account_status(
  p_user_id uuid, p_status text, p_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF NOT public._is_extreme_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  IF p_status NOT IN ('active','suspended','banned') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF p_user_id=auth.uid() AND p_status<>'active' THEN RAISE EXCEPTION 'Cannot disable the active Super Admin'; END IF;
  UPDATE public.profiles SET account_status=p_status,updated_at=now() WHERE id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  INSERT INTO public.admin_audit_logs(actor_id,action,target_type,target_id,metadata)
  VALUES(auth.uid(),'root_set_account_status','user',p_user_id,jsonb_build_object('status',p_status,'reason',p_reason));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.extreme_admin_resolve_report(
  p_report_id uuid, p_status text, p_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF NOT public._is_extreme_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  IF p_status NOT IN ('pending','reviewed','resolved','dismissed') THEN RAISE EXCEPTION 'Invalid report status'; END IF;
  UPDATE public.reports SET status=p_status WHERE id=p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;
  INSERT INTO public.admin_audit_logs(actor_id,action,target_type,target_id,metadata)
  VALUES(auth.uid(),'root_resolve_report','report',p_report_id,jsonb_build_object('status',p_status,'reason',p_reason));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.extreme_admin_delete_post(
  p_post_id uuid, p_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF NOT public._is_extreme_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  DELETE FROM public.social_posts WHERE id=p_post_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post not found'; END IF;
  INSERT INTO public.admin_audit_logs(actor_id,action,target_type,target_id,metadata)
  VALUES(auth.uid(),'root_delete_post','social_post',p_post_id,jsonb_build_object('reason',p_reason));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.extreme_admin_delete_book(
  p_book_id uuid, p_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF NOT public._is_extreme_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  DELETE FROM public.library_books WHERE id=p_book_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Book not found'; END IF;
  INSERT INTO public.admin_audit_logs(actor_id,action,target_type,target_id,metadata)
  VALUES(auth.uid(),'root_delete_book','library_book',p_book_id,jsonb_build_object('reason',p_reason));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.extreme_admin_finance_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public._is_extreme_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  IF to_regclass('public.finance_accounts') IS NULL THEN
    RETURN jsonb_build_object('available',false,'message','Finance schema not deployed yet');
  END IF;
  EXECUTE $q$
    SELECT jsonb_build_object(
      'available',true,
      'accounts',(SELECT count(*) FROM public.finance_accounts),
      'invoices',(SELECT count(*) FROM public.finance_invoices),
      'payments',(SELECT count(*) FROM public.finance_payments),
      'transactions',(SELECT count(*) FROM public.finance_transactions),
      'budgets',(SELECT count(*) FROM public.finance_budgets),
      'balance',(SELECT COALESCE(sum(current_balance),0) FROM public.finance_accounts WHERE active)
    )
  $q$ INTO v;
  RETURN v;
END $$;

GRANT EXECUTE ON FUNCTION public.extreme_admin_get_system_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_role(uuid,public.app_role,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_account_status(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_resolve_report(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_delete_post(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_delete_book(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_finance_overview() TO authenticated;
