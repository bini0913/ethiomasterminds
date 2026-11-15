-- Restrict attendance-session visibility to the same people allowed to see its records.
-- The previous EXISTS check exposed any session that had at least one record.

DROP POLICY IF EXISTS school_attendance_sessions_read ON public.school_attendance_sessions;

CREATE POLICY school_attendance_sessions_read ON public.school_attendance_sessions
FOR SELECT TO authenticated
USING (
  public._is_extreme_admin()
  OR public.is_school_manager_or_admin(school_id)
  OR public.school_is_homeroom_teacher(school_id, section_id)
  OR EXISTS (
    SELECT 1
    FROM public.school_attendance_records record
    WHERE record.session_id = school_attendance_sessions.id
      AND public.school_can_view_attendance_record(record.id)
  )
);
