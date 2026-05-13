
CREATE TABLE IF NOT EXISTS public.parent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  deadline date,
  status text NOT NULL DEFAULT 'pending',
  created_by text NOT NULL DEFAULT 'parent',
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parent_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student manages own parent tasks" ON public.parent_tasks
  FOR ALL USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
CREATE TRIGGER parent_tasks_updated_at BEFORE UPDATE ON public.parent_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.parent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  message text NOT NULL,
  emoji text DEFAULT '💪',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student manages own parent messages" ON public.parent_messages
  FOR ALL USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

CREATE TABLE IF NOT EXISTS public.parent_goals (
  student_id uuid PRIMARY KEY,
  daily_study_minutes int NOT NULL DEFAULT 60,
  weekly_quiz_target int NOT NULL DEFAULT 10,
  daily_xp_target int NOT NULL DEFAULT 200,
  bedtime_hour int,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parent_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student manages own goals" ON public.parent_goals
  FOR ALL USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
CREATE TRIGGER parent_goals_updated_at BEFORE UPDATE ON public.parent_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
