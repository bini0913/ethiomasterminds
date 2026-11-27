begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can read accessible library files'
      and cmd = 'SELECT'
      and coalesce(qual, '') like '%library_books%'
      and coalesce(qual, '') like '%pdf_path%'
      and coalesce(qual, '') like '%uploader_id%'
      and coalesce(qual, '') like '%foldername%'
  ),
  'signed PDF reads follow library_books row visibility'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can read accessible library thumbnails'
      and cmd = 'SELECT'
      and coalesce(qual, '') like '%library_books%'
      and coalesce(qual, '') like '%thumbnail_path%'
      and coalesce(qual, '') like '%uploader_id%'
      and coalesce(qual, '') like '%foldername%'
  ),
  'signed thumbnail reads follow library_books row visibility'
);

select ok(
  exists (
    select 1 from storage.buckets
    where id = 'library-files' and public = false
  ),
  'library PDF bucket remains private'
);

select ok(
  exists (
    select 1 from storage.buckets
    where id = 'library-thumbnails' and public = false
  ),
  'library thumbnail bucket remains private'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can view own library file metadata'
      and cmd = 'SELECT'
  ),
  'uploader-owned PDF access policy is preserved'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can view own library thumbnail metadata'
      and cmd = 'SELECT'
  ),
  'uploader-owned thumbnail access policy is preserved'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'library_books'
      and policyname = 'authenticated can view approved books'
      and cmd = 'SELECT'
  ),
  'storage visibility is anchored to the existing library access policy'
);

select ok(
  not exists (
    select 1 from storage.buckets
    where id in ('library-files', 'library-thumbnails')
      and public = true
  ),
  'no library bucket is made public to solve signed-read access'
);


select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can delete own library files'
      and cmd = 'DELETE'
      and coalesce(qual, '') like '%library-files%'
      and coalesce(qual, '') like '%auth.jwt%'
  ),
  'uploaders can clean up only their own PDF folder'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can delete own library thumbnails'
      and cmd = 'DELETE'
      and coalesce(qual, '') like '%library-thumbnails%'
      and coalesce(qual, '') like '%auth.jwt%'
  ),
  'uploaders can clean up only their own thumbnail folder'
);

select * from finish();
rollback;
