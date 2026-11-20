-- Close direct table-write paths that bypass guarded school workflows.
-- Explicit REVOKEs override any broader Supabase default privileges.
-- Teacher edits to homework assignments remain available through the existing
-- RLS policy and validation trigger; only destructive deletion is blocked.

REVOKE INSERT ON TABLE
  public.school_conversations,
  public.school_conversation_participants
FROM PUBLIC, anon, authenticated;

REVOKE INSERT ON TABLE public.school_content_review_events
FROM PUBLIC, anon, authenticated;

REVOKE DELETE ON TABLE
  public.school_homework_assignments,
  public.school_homework_submissions
FROM PUBLIC, anon, authenticated;

REVOKE DELETE ON TABLE public.school_staff_tasks
FROM PUBLIC, anon, authenticated;

REVOKE UPDATE, DELETE ON TABLE
  public.school_staff_evaluations,
  public.school_disciplinary_recommendations,
  public.school_staff_change_requests
FROM PUBLIC, anon, authenticated;
