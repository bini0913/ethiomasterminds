-- Improve source navigation for the Ethiopian entrance-paper catalog.
-- Each catalog entry links to the archive's matching Ethiopian exam-year index rather than
-- sending every student to the generic archive landing page. The year page lists papers
-- by subject; it is still an external reference and does not certify answers.
update public.entrance_exam_papers
set source_url = 'https://webmail.temari.et/exam-prep/papers/grade-12-' || ethiopian_year::text,
    notes = 'Year-level archive page. Check the listed subject, stream/version, paper file, and answer key on the source before using it as verified content.'
where grade_level = 12
  and exam_type = 'university_entrance'
  and source_name = 'Temari past-paper archive';

-- Ensure the known 2013 E.C. year index is represented across its listed subjects.
-- The unique key makes this safe to apply when some rows already exist.
insert into public.entrance_exam_papers
  (grade_level, exam_type, subject, ethiopian_year, gregorian_year, stream, source_name, source_url, source_status, notes)
values
  (12,'university_entrance','Biology',2013,2021,'Both / varies by paper','Temari past-paper archive','https://webmail.temari.et/exam-prep/papers/grade-12-2013','external_reference','Year-level archive page. Check the listed subject, stream/version, paper file, and answer key on the source before using it as verified content.'),
  (12,'university_entrance','Chemistry',2013,2021,'Both / varies by paper','Temari past-paper archive','https://webmail.temari.et/exam-prep/papers/grade-12-2013','external_reference','Year-level archive page. Check the listed subject, stream/version, paper file, and answer key on the source before using it as verified content.'),
  (12,'university_entrance','Civics',2013,2021,'Both / varies by paper','Temari past-paper archive','https://webmail.temari.et/exam-prep/papers/grade-12-2013','external_reference','Year-level archive page. Check the listed subject, stream/version, paper file, and answer key on the source before using it as verified content.'),
  (12,'university_entrance','English',2013,2021,'Both / varies by paper','Temari past-paper archive','https://webmail.temari.et/exam-prep/papers/grade-12-2013','external_reference','Year-level archive page. Check the listed subject, stream/version, paper file, and answer key on the source before using it as verified content.'),
  (12,'university_entrance','Geography',2013,2021,'Both / varies by paper','Temari past-paper archive','https://webmail.temari.et/exam-prep/papers/grade-12-2013','external_reference','Year-level archive page. Check the listed subject, stream/version, paper file, and answer key on the source before using it as verified content.'),
  (12,'university_entrance','History',2013,2021,'Both / varies by paper','Temari past-paper archive','https://webmail.temari.et/exam-prep/papers/grade-12-2013','external_reference','Year-level archive page. Check the listed subject, stream/version, paper file, and answer key on the source before using it as verified content.'),
  (12,'university_entrance','Mathematics',2013,2021,'Both / varies by paper','Temari past-paper archive','https://webmail.temari.et/exam-prep/papers/grade-12-2013','external_reference','Year-level archive page. Check the listed subject, stream/version, paper file, and answer key on the source before using it as verified content.'),
  (12,'university_entrance','Physics',2013,2021,'Both / varies by paper','Temari past-paper archive','https://webmail.temari.et/exam-prep/papers/grade-12-2013','external_reference','Year-level archive page. Check the listed subject, stream/version, paper file, and answer key on the source before using it as verified content.'),
  (12,'university_entrance','Scholastic Aptitude',2013,2021,'Both / varies by paper','Temari past-paper archive','https://webmail.temari.et/exam-prep/papers/grade-12-2013','external_reference','Year-level archive page. Check the listed subject, stream/version, paper file, and answer key on the source before using it as verified content.')
on conflict (grade_level, exam_type, subject, ethiopian_year, stream, source_name)
do update set
  gregorian_year = excluded.gregorian_year,
  source_url = excluded.source_url,
  source_status = excluded.source_status,
  notes = excluded.notes;
