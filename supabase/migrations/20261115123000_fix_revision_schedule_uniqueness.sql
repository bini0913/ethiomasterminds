-- A learner has one spaced-repetition schedule per question.
-- Older deployments allowed duplicates, which made the client's upsert
-- conflict target invalid. Keep the newest row before enforcing the contract.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, question_id
      ORDER BY created_at DESC, id DESC
    ) AS row_number
  FROM public.revision_schedule
)
DELETE FROM public.revision_schedule schedule
USING ranked duplicate
WHERE schedule.id = duplicate.id
  AND duplicate.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS revision_schedule_user_question_uidx
  ON public.revision_schedule (user_id, question_id);
