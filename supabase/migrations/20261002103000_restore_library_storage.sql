-- Restore the Supabase Storage buckets required by the Library upload flow.
-- The frontend uploads to library-files and library-thumbnails and serves PDFs
-- through getPublicUrl(), so these buckets must exist and be public for reads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('library-files', 'library-files', true, 52428800, array['application/pdf']::text[]),
  ('library-thumbnails', 'library-thumbnails', true, 5242880, array['image/png','image/jpeg','image/webp']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can upload library files" on storage.objects;
create policy "Authenticated users can upload library files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'library-files'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
);

drop policy if exists "Authenticated users can view own library file metadata" on storage.objects;
create policy "Authenticated users can view own library file metadata"
on storage.objects for select
to authenticated
using (
  bucket_id = 'library-files'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
);

drop policy if exists "Authenticated users can upload library thumbnails" on storage.objects;
create policy "Authenticated users can upload library thumbnails"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'library-thumbnails'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
);

drop policy if exists "Authenticated users can view own library thumbnail metadata" on storage.objects;
create policy "Authenticated users can view own library thumbnail metadata"
on storage.objects for select
to authenticated
using (
  bucket_id = 'library-thumbnails'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
);