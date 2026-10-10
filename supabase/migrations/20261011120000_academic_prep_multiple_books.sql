alter table public.academic_profiles
  add column if not exists book_ids uuid[] not null default '{}';

update public.academic_profiles
set book_ids = array[book_id]
where book_id is not null
  and coalesce(array_length(book_ids, 1), 0) = 0;
