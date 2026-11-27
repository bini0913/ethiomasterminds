-- Allow authenticated readers to obtain signed URLs for library files they can
-- already see through public.library_books RLS. The buckets remain private.
-- This keeps file access aligned with individual and school library visibility.
drop policy if exists "Authenticated users can read accessible library files" on storage.objects;
create policy "Authenticated users can read accessible library files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'library-files'
  and exists (
    select 1
    from public.library_books b
    where b.pdf_path = name
  )
);

drop policy if exists "Authenticated users can read accessible library thumbnails" on storage.objects;
create policy "Authenticated users can read accessible library thumbnails"
on storage.objects for select
to authenticated
using (
  bucket_id = 'library-thumbnails'
  and exists (
    select 1
    from public.library_books b
    where b.thumbnail_path = name
  )
);

-- Failed uploads and uploader-initiated book deletion must be able to clean up
-- objects in the caller's own folder. These policies do not grant cross-user deletes.
drop policy if exists "Authenticated users can delete own library files" on storage.objects;
create policy "Authenticated users can delete own library files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'library-files'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
);

drop policy if exists "Authenticated users can delete own library thumbnails" on storage.objects;
create policy "Authenticated users can delete own library thumbnails"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'library-thumbnails'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
);

-- Prevent ordinary uploaders from registering another user's storage path on a
-- library_books row. The storage read policy also verifies this folder binding.
drop policy if exists "authenticated can upload books" on public.library_books;
create policy "authenticated can upload books"
on public.library_books for insert
to authenticated
with check (
  uploader_id = (select auth.uid())
  and split_part(pdf_path, '/', 1) = (select auth.uid())::text
  and (
    thumbnail_path is null
    or split_part(thumbnail_path, '/', 1) = (select auth.uid())::text
  )
);

-- The existing ALL policy is permissive and also applies to INSERT/UPDATE.
-- Keep its current ownership/manager rules while enforcing uploader-folder
-- binding for ordinary owners, so it cannot bypass the narrower INSERT policy.
alter policy "uploader manages own book"
on public.library_books
with check (
  (
    (school_id is null)
    and (
      (
        uploader_id = (select auth.uid())
        and split_part(pdf_path, '/', 1) = (select auth.uid())::text
        and (
          thumbnail_path is null
          or split_part(thumbnail_path, '/', 1) = (select auth.uid())::text
        )
      )
      or has_role((select auth.uid()), 'admin'::app_role)
      or has_role((select auth.uid()), 'manager'::app_role)
    )
  )
  or (
    school_id is not null
    and school_can_manage_library_book(id)
  )
);
