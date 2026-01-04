-- Create helper functions to break RLS recursion chain

-- Function to check if a user is a student in a class
CREATE OR REPLACE FUNCTION public.is_student_in_class(p_student_id uuid, p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM class_students
    WHERE student_id = p_student_id AND class_id = p_class_id
  )
$$;

-- Function to check if a user is a teacher of a class
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(p_teacher_id uuid, p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM classes
    WHERE id = p_class_id AND teacher_id = p_teacher_id
  )
$$;

-- Function to check if a teacher has a student in any of their classes
CREATE OR REPLACE FUNCTION public.is_teacher_of_student(p_teacher_id uuid, p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM class_students cs
    JOIN classes c ON c.id = cs.class_id
    WHERE cs.student_id = p_student_id AND c.teacher_id = p_teacher_id
  )
$$;

-- Drop problematic RLS policies that cause recursion
DROP POLICY IF EXISTS "Teachers can view students in their classes" ON profiles;
DROP POLICY IF EXISTS "Students can view classes they belong to" ON classes;
DROP POLICY IF EXISTS "Teachers can manage class students" ON class_students;

-- Recreate profiles policy using helper function (no recursion)
CREATE POLICY "Teachers can view students in their classes" ON profiles
FOR SELECT USING (
  auth.uid() = id
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR is_teacher_of_student(auth.uid(), id)
);

-- Recreate classes policy using helper function (no recursion)
CREATE POLICY "Students can view classes they belong to" ON classes
FOR SELECT USING (
  teacher_id = auth.uid()
  OR is_student_in_class(auth.uid(), id)
  OR has_role(auth.uid(), 'teacher')
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
);

-- Recreate class_students policy using helper function (no recursion)
CREATE POLICY "Teachers can manage class students" ON class_students
FOR ALL USING (
  is_teacher_of_class(auth.uid(), class_id)
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
);