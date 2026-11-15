-- Ensure extreme_admin is treated as the highest-priority role
-- when resolving the primary role for post-login routing.
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
    ORDER BY
        CASE role
            WHEN 'extreme_admin' THEN 1
            WHEN 'manager' THEN 2
            WHEN 'admin' THEN 3
            WHEN 'teacher' THEN 4
            WHEN 'student' THEN 5
            ELSE 99
        END,
        created_at ASC
    LIMIT 1
$$;
