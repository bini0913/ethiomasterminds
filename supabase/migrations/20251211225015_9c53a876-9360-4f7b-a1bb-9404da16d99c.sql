-- Teacher and Admin access codes table
CREATE TABLE public.access_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    code_type TEXT NOT NULL CHECK (code_type IN ('teacher', 'admin')),
    is_used BOOLEAN DEFAULT false,
    used_by UUID REFERENCES auth.users(id),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Classes table
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    class_code TEXT NOT NULL UNIQUE,
    teacher_id UUID NOT NULL,
    description TEXT,
    grade TEXT,
    subject TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Class students junction table
CREATE TABLE public.class_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    student_id UUID NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(class_id, student_id)
);

-- Quizzes table
CREATE TABLE public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    subject TEXT NOT NULL,
    grade TEXT,
    difficulty TEXT DEFAULT 'medium',
    created_by UUID NOT NULL,
    is_approved BOOLEAN DEFAULT false,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    is_public BOOLEAN DEFAULT false,
    time_limit INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Questions table
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'multiple_choice',
    options JSONB,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    points INTEGER DEFAULT 10,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Quiz assignments table
CREATE TABLE public.quiz_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID,
    assigned_by UUID NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    is_mandatory BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Student quiz results table
CREATE TABLE public.quiz_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
    student_id UUID NOT NULL,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    time_taken INTEGER,
    xp_earned INTEGER DEFAULT 0,
    answers JSONB,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Announcements table
CREATE TABLE public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('all', 'students', 'teachers', 'class', 'user')),
    target_id UUID,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- NPC settings table (admin only)
CREATE TABLE public.npc_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    difficulty TEXT NOT NULL DEFAULT 'medium',
    answer_speed_ms INTEGER DEFAULT 3000,
    accuracy_percent INTEGER DEFAULT 70,
    intelligence_scaling BOOLEAN DEFAULT true,
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default NPC settings
INSERT INTO public.npc_settings (difficulty, answer_speed_ms, accuracy_percent) 
VALUES ('medium', 3000, 70);

-- Insert some default access codes for testing
INSERT INTO public.access_codes (code, code_type) VALUES 
('TEACHER2024', 'teacher'),
('ADMIN2024', 'admin');

-- Enable RLS on all tables
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npc_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for access_codes
CREATE POLICY "Admins can manage access codes" ON public.access_codes
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Anyone can check code validity" ON public.access_codes
FOR SELECT USING (true);

-- RLS Policies for classes
CREATE POLICY "Teachers can manage own classes" ON public.classes
FOR ALL USING (teacher_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Students can view classes they belong to" ON public.classes
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.class_students WHERE class_id = classes.id AND student_id = auth.uid())
    OR has_role(auth.uid(), 'teacher')
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
);

-- RLS Policies for class_students
CREATE POLICY "Teachers can manage class students" ON public.class_students
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.classes WHERE id = class_id AND teacher_id = auth.uid())
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
);

CREATE POLICY "Students can view own class membership" ON public.class_students
FOR SELECT USING (student_id = auth.uid());

-- RLS Policies for quizzes
CREATE POLICY "Teachers can manage own quizzes" ON public.quizzes
FOR ALL USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Students can view approved/assigned quizzes" ON public.quizzes
FOR SELECT USING (
    is_approved = true 
    OR EXISTS (SELECT 1 FROM public.quiz_assignments WHERE quiz_id = quizzes.id AND (student_id = auth.uid() OR class_id IN (SELECT class_id FROM public.class_students WHERE student_id = auth.uid())))
);

-- RLS Policies for questions
CREATE POLICY "Quiz creators can manage questions" ON public.questions
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.quizzes WHERE id = quiz_id AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
);

CREATE POLICY "Students can view questions for assigned quizzes" ON public.questions
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.quizzes WHERE id = quiz_id AND is_approved = true)
);

-- RLS Policies for quiz_assignments
CREATE POLICY "Teachers can manage assignments" ON public.quiz_assignments
FOR ALL USING (assigned_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Students can view own assignments" ON public.quiz_assignments
FOR SELECT USING (student_id = auth.uid() OR class_id IN (SELECT class_id FROM public.class_students WHERE student_id = auth.uid()));

-- RLS Policies for quiz_results
CREATE POLICY "Students can manage own results" ON public.quiz_results
FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers can view class results" ON public.quiz_results
FOR SELECT USING (
    has_role(auth.uid(), 'teacher') 
    OR has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'manager')
);

-- RLS Policies for announcements
CREATE POLICY "Authors can manage announcements" ON public.announcements
FOR ALL USING (author_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Users can view relevant announcements" ON public.announcements
FOR SELECT USING (
    target_type = 'all'
    OR (target_type = 'students' AND has_role(auth.uid(), 'student'))
    OR (target_type = 'teachers' AND has_role(auth.uid(), 'teacher'))
    OR target_id = auth.uid()
    OR (target_type = 'class' AND target_id IN (SELECT class_id FROM public.class_students WHERE student_id = auth.uid()))
);

-- RLS Policies for npc_settings
CREATE POLICY "Admins can manage NPC settings" ON public.npc_settings
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Anyone can view NPC settings" ON public.npc_settings
FOR SELECT USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON public.quizzes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_npc_settings_updated_at BEFORE UPDATE ON public.npc_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();