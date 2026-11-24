-- Expose only pending school quiz and library submissions inside an active
-- academic-leadership appointment's grade/section scope. Existing review RPCs
-- remain responsible for the actual approve/reject transition.
BEGIN;

CREATE OR REPLACE FUNCTION public.school_list_pending_content_reviews(p_school_id uuid)
RETURNS TABLE (
  content_type text,
  content_id uuid,
  title text,
  subject_name text,
  grade_label text,
  section_id uuid,
  submitted_at timestamptz,
  submitted_by_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'A school is required';
  END IF;

  RETURN QUERY
  SELECT
    'quiz'::text,
    quiz.id,
    quiz.title,
    quiz.subject,
    quiz.grade,
    quiz.school_section_id,
    quiz.created_at,
    coalesce(profile.name, 'Teacher')::text
  FROM public.quizzes quiz
  LEFT JOIN public.profiles profile ON profile.id = quiz.created_by
  WHERE quiz.school_id = p_school_id
    AND quiz.school_review_status = 'pending'
    AND public.school_leadership_has_permission(
      quiz.school_id, 'review_assessments', quiz.grade, NULL, quiz.school_section_id
    )

  UNION ALL

  SELECT
    'library_book'::text,
    book.id,
    book.title,
    book.subject,
    book.school_grade_label,
    book.school_section_id,
    book.created_at,
    coalesce(profile.name, 'Teacher')::text
  FROM public.library_books book
  LEFT JOIN public.profiles profile ON profile.id = book.uploader_id
  WHERE book.school_id = p_school_id
    AND book.school_review_status = 'pending'
    AND public.school_leadership_has_permission(
      book.school_id, 'review_assessments', book.school_grade_label, NULL, book.school_section_id
    )
  ORDER BY submitted_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.school_list_pending_content_reviews(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_list_pending_content_reviews(uuid) TO authenticated;

COMMIT;
