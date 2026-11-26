-- The teacher-student relationship oracle is not used by any RLS policy or app RPC.
-- Remove direct client execution; policy helpers is_student_in_class/is_teacher_of_class
-- remain available because they are referenced by existing RLS policies.
revoke all on function public.is_teacher_of_student(uuid, uuid) from public, anon, authenticated;
