begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'curriculum_textbook_catalog'
      and column_name = 'official_portal_url'
  ),
  'curriculum catalog exposes the official Ministry portal separately'
);

select is(
  (select count(*)::integer from public.curriculum_textbook_catalog where grade_level = 9),
  13,
  'Grade 9 catalog matches the referenced textbook index'
);

select is(
  (select count(*)::integer from public.curriculum_textbook_catalog where grade_level = 10),
  13,
  'Grade 10 catalog matches the referenced textbook index'
);

select is(
  (select count(*)::integer from public.curriculum_textbook_catalog where grade_level = 11),
  10,
  'Grade 11 catalog matches the referenced textbook index'
);

select is(
  (select count(*)::integer from public.curriculum_textbook_catalog where grade_level = 12),
  10,
  'Grade 12 catalog matches the referenced textbook index'
);

select ok(
  not exists (
    select 1 from public.curriculum_textbook_catalog
    where grade_level between 9 and 12
      and (source_status <> 'external_reference'
        or source_name not ilike '%St John%'
        or source_url <> 'https://lts.stjohn.edu.et/find-borrow-request/moe-textbooks'
        or official_portal_url <> 'https://moe.gov.et/resources/digital-library-e-learning?lang=en')
  ),
  'third-party textbook index and official Ministry portal are clearly distinguished'
);

select ok(
  not exists (
    select 1 from public.curriculum_textbook_catalog
    where (grade_level in (9, 10) and subject = 'Agriculture')
       or (grade_level in (11, 12) and subject in ('Afan Oromo', 'Amharic', 'Citizenship', 'Health and Physical Education'))
  ),
  'grade-specific subjects excluded by the referenced index are not presented as catalog entries'
);

select * from finish();
rollback;
