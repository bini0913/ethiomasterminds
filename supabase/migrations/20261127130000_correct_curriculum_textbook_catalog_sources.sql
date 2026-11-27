-- Correct the Grade 9–12 textbook index to match the subjects actually listed
-- by the referenced school library index, and distinguish that third-party index
-- from the Ministry's official digital-library entry point.
alter table public.curriculum_textbook_catalog
  add column if not exists official_portal_url text;

delete from public.curriculum_textbook_catalog
where grade_level in (9, 10)
  and subject = 'Agriculture';

delete from public.curriculum_textbook_catalog
where grade_level in (11, 12)
  and subject in ('Afan Oromo', 'Amharic', 'Citizenship', 'Health and Physical Education');

update public.curriculum_textbook_catalog
set source_name = 'St John Baptist De La Salle Catholic School — textbook index',
    source_url = 'https://lts.stjohn.edu.et/find-borrow-request/moe-textbooks',
    official_portal_url = 'https://moe.gov.et/resources/digital-library-e-learning?lang=en',
    source_status = 'external_reference',
    notes = 'Third-party school library index listing Ethiopian Ministry of Education textbook PDFs labelled 2023 web. This is an external index, not Ministry-hosted file storage. The curriculum-year field is a catalog grouping, not a verified publication date. Check the official Ministry digital-library portal for current availability and editions.'
where grade_level between 9 and 12;
