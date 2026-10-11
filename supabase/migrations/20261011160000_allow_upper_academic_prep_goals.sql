-- Allow every goal offered by the Grades 9–12 Academic Prep setup.
-- The UI already offers these values; the original table constraint rejected them,
-- causing the generic "couldn't save your Academic Prep setup" message on Finish setup.
alter table public.academic_profiles
  drop constraint if exists academic_profiles_study_goal_check;

alter table public.academic_profiles
  add constraint academic_profiles_study_goal_check
  check (
    study_goal in (
      'class',
      'ministry_exam',
      'university_entrance',
      'national_exam',
      'entrance_exam',
      'exit_exam',
      'mock_exam',
      'past_papers',
      'custom'
    )
  );
