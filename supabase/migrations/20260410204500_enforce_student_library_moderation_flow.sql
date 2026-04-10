-- Enforce moderation workflow:
-- 1) Student uploads must stay pending until a moderator approves/rejects.
-- 2) Admin approval publishes books to everyone through existing approved-book queries.

-- Guardrail: force student uploads to start as pending at DB level.
CREATE OR REPLACE FUNCTION public.enforce_student_library_pending_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.uploader_role = 'student' THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_student_library_pending_status_trigger ON public.library_books;
CREATE TRIGGER enforce_student_library_pending_status_trigger
BEFORE INSERT ON public.library_books
FOR EACH ROW
EXECUTE FUNCTION public.enforce_student_library_pending_status();

-- Repair any student books that were auto-published without real moderation.
WITH unmoderated_student_books AS (
  SELECT lb.id
  FROM public.library_books lb
  LEFT JOIN public.book_uploads bu ON bu.book_id = lb.id
  WHERE lb.uploader_role = 'student'
  GROUP BY lb.id
  HAVING COALESCE(bool_or(bu.moderated_by IS NOT NULL AND bu.status IN ('approved', 'rejected')), false) = false
)
UPDATE public.library_books lb
SET status = 'pending',
    updated_at = now()
FROM unmoderated_student_books usb
WHERE lb.id = usb.id
  AND lb.status <> 'pending';

-- Keep upload audit table aligned for those repaired rows.
UPDATE public.book_uploads bu
SET status = 'pending',
    moderated_at = NULL,
    moderated_by = NULL,
    moderation_note = 'Awaiting teacher/admin moderation',
    updated_at = now()
FROM public.library_books lb
WHERE bu.book_id = lb.id
  AND lb.uploader_role = 'student'
  AND lb.status = 'pending'
  AND bu.status <> 'pending';
