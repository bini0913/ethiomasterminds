-- Ensure approved uploads are visible in the student library portal,
-- and publish legacy pending books that were uploaded before this fix.

-- 1) Backfill missing upload audit rows for any historical library book.
INSERT INTO public.book_uploads (book_id, uploader_id, status, moderation_note, moderated_at)
SELECT
  lb.id,
  lb.uploader_id,
  lb.status,
  CASE
    WHEN lb.status = 'approved' THEN 'Backfilled from library_books as approved.'
    WHEN lb.status = 'rejected' THEN 'Backfilled from library_books as rejected.'
    ELSE 'Backfilled from library_books as pending.'
  END,
  CASE WHEN lb.status IN ('approved', 'rejected') THEN now() ELSE NULL END
FROM public.library_books lb
LEFT JOIN public.book_uploads bu ON bu.book_id = lb.id
WHERE bu.id IS NULL;

-- 2) Keep library_books aligned with the latest moderation status if book_uploads has a final decision.
WITH latest_upload AS (
  SELECT DISTINCT ON (book_id)
    book_id,
    status,
    moderated_at
  FROM public.book_uploads
  ORDER BY book_id, COALESCE(moderated_at, created_at) DESC, created_at DESC, id DESC
)
UPDATE public.library_books lb
SET status = lu.status,
    updated_at = now()
FROM latest_upload lu
WHERE lb.id = lu.book_id
  AND lu.status IN ('approved', 'rejected')
  AND lb.status IS DISTINCT FROM lu.status;

-- 3) Publish legacy books that were still pending before this migration,
-- so previously uploaded books become visible in student portal.
UPDATE public.library_books
SET status = 'approved',
    updated_at = now()
WHERE status = 'pending'
  AND created_at < now();

-- 4) Reflect this publishing change in moderation audit rows.
UPDATE public.book_uploads bu
SET status = 'approved',
    moderated_at = COALESCE(bu.moderated_at, now()),
    moderation_note = COALESCE(NULLIF(bu.moderation_note, ''), 'Published by legacy backfill migration.'),
    updated_at = now()
FROM public.library_books lb
WHERE bu.book_id = lb.id
  AND lb.status = 'approved'
  AND bu.status = 'pending';
