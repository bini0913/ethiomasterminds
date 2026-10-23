-- Link each entrance-paper catalog row to the archive page for its actual subject.
-- The archive is organized by subject (for example, grade-12-biology), not by Ethiopian year.
-- These remain third-party references, not imported/verified question text.
update public.entrance_exam_papers
set source_url = 'https://webmail.temari.et/exam-prep/papers/grade-12-' ||
  case
    when lower(subject) = 'mathematics' then 'mathematics'
    when lower(subject) = 'scholastic aptitude' then 'scholastic-aptitude'
    else replace(lower(subject), ' ', '-')
  end,
  notes = 'Subject archive page. Select the relevant Ethiopian/Gregorian year and verify the paper, stream/version, and answer key at the source. External reference only; questions are not imported into Master Minds.'
where grade_level = 12
  and exam_type = 'university_entrance'
  and source_name = 'Temari past-paper archive';
