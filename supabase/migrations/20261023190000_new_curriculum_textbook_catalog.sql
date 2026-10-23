-- New-curriculum textbook catalog for Grades 9–12.
-- The curriculum-year field records the user's requested 2019 E.C. curriculum grouping;
-- it is not a claim that every textbook was published in that year.
-- Store source links and metadata only; do not copy textbook PDFs into the repo.
create table if not exists public.curriculum_textbook_catalog (
  id uuid primary key default gen_random_uuid(),
  grade_level integer not null check (grade_level between 9 and 12),
  curriculum_year_ec integer not null default 2019,
  subject text not null,
  book_title text not null,
  resource_type text not null default 'student_textbook'
    check (resource_type in ('student_textbook','teacher_guide','supplementary')),
  source_name text not null,
  source_url text not null,
  source_status text not null default 'external_reference'
    check (source_status in ('verified_official','external_reference','needs_review')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (grade_level, curriculum_year_ec, subject, book_title)
);

alter table public.curriculum_textbook_catalog enable row level security;
drop policy if exists "Authenticated users can read textbook catalog" on public.curriculum_textbook_catalog;
create policy "Authenticated users can read textbook catalog"
  on public.curriculum_textbook_catalog for select to authenticated using (true);

create index if not exists curriculum_textbook_catalog_grade_subject_idx
  on public.curriculum_textbook_catalog (grade_level, subject);

-- This is an index of books to locate, not a claim that every subject PDF is hosted
-- at the same address. The source page lists MOE textbooks by grade and subject.
-- Entries remain external_reference until each individual book file is checked.
with subjects(subject) as (
  values
    ('Afan Oromo'), ('Amharic'), ('Biology'), ('Chemistry'), ('Citizenship'),
    ('Economics'), ('English'), ('Geography'), ('History'),
    ('Information Technology'), ('Mathematics'), ('Physics'), ('Agriculture'),
    ('Health and Physical Education')
),
grades(grade_level) as (values (9), (10), (11), (12))
insert into public.curriculum_textbook_catalog
  (grade_level, curriculum_year_ec, subject, book_title, resource_type, source_name, source_url, source_status, notes)
select
  grades.grade_level,
  2019,
  subjects.subject,
  'Grade ' || grades.grade_level || ' ' || subjects.subject || ' Student Textbook',
  'student_textbook',
  'MOE textbook index (external listing)',
  'https://lts.stjohn.edu.et/find-borrow-request/moe-textbooks',
  'external_reference',
  'Catalog entry for the requested new-curriculum collection, grouped as 2019 E.C. Individual file availability and edition must be confirmed on the source page before this is treated as a verified textbook.'
from grades cross join subjects
on conflict (grade_level, curriculum_year_ec, subject, book_title) do update
set source_url = excluded.source_url,
    source_name = excluded.source_name,
    source_status = excluded.source_status,
    notes = excluded.notes;
