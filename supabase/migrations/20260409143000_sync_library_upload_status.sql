-- Keep upload moderation table and library_books status in sync automatically.
CREATE UNIQUE INDEX IF NOT EXISTS book_uploads_book_id_unique_idx
ON public.book_uploads (book_id);

CREATE OR REPLACE FUNCTION public.sync_library_book_uploads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.book_uploads (book_id, uploader_id, status, moderation_note, moderated_at)
    VALUES (
      NEW.id,
      NEW.uploader_id,
      NEW.status,
      CASE WHEN NEW.status = 'approved' THEN 'Auto-approved by role policy' ELSE 'Awaiting teacher/admin moderation' END,
      CASE WHEN NEW.status = 'approved' THEN now() ELSE NULL END
    )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(NEW.status, '') <> COALESCE(OLD.status, '') THEN
    UPDATE public.book_uploads
    SET status = NEW.status,
        moderation_note = COALESCE(moderation_note, 'Status synced from library_books'),
        moderated_at = now(),
        updated_at = now()
    WHERE book_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_library_book_uploads_trigger ON public.library_books;
CREATE TRIGGER sync_library_book_uploads_trigger
AFTER INSERT OR UPDATE OF status ON public.library_books
FOR EACH ROW
EXECUTE FUNCTION public.sync_library_book_uploads();
