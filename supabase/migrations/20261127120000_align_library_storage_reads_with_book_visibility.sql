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
