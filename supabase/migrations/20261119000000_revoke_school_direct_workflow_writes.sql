-- Close direct table-write paths that bypass the school workflow RPCs.
-- These REVOKEs are explicit because Supabase default privileges may have
-- granted broader table privileges before the school-specific migrations.
-- SECURITY DEFINER workflow RPCs continue to perform the guarded mutations.

REVOKE INSERT ON TABLE
  public.school_conversations,
  public.school_conversation_participants
FROM PUBLIC, anon, authenticated;

REVOKE INSERT ON TABLE public.school_content_review_events
FROM PUBLIC, anon, authenticated;

REVOKE UPDATE, DELETE ON TABLE public.school_homework_assignments
FROM PUBLIC, anon, authenticated;

REVOKE DELETE ON TABLE public.school_homework_submissions
FROM PUBLIC, anon, authenticated;

REVOKE DELETE ON TABLE public.school_staff_tasks
FROM PUBLIC, anon, authenticated;

REVOKE UPDATE, DELETE ON TABLE
  public.school_staff_evaluations,
  public.school_disciplinary_recommendations,
  public.school_staff_change_requests
FROM PUBLIC, anon, authenticated;
