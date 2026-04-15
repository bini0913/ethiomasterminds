-- Study Mode core tables: sessions, tasks, rooms, and members

CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duration INTEGER NOT NULL CHECK (duration > 0),
  type TEXT NOT NULL CHECK (type IN ('pomodoro', 'custom', 'deep_focus')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  completed BOOLEAN NOT NULL DEFAULT false,
  linked_session_id UUID REFERENCES public.study_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.room_members (
  room_id UUID NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  study_time INTEGER NOT NULL DEFAULT 0,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  focus_streak INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS study_sessions_user_id_created_at_idx
  ON public.study_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS study_tasks_user_id_created_at_idx
  ON public.study_tasks (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS room_members_user_id_idx
  ON public.room_members (user_id);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.study_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON public.study_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view and manage own tasks"
  ON public.study_tasks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view rooms they host or joined"
  ON public.study_rooms
  FOR SELECT
  USING (
    auth.uid() = host_id OR EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = id AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can host rooms"
  ON public.study_rooms
  FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Members can view room membership"
  ON public.room_members
  FOR SELECT
  USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.study_rooms sr
      WHERE sr.id = room_id AND sr.host_id = auth.uid()
    )
  );

CREATE POLICY "Users can join rooms as themselves"
  ON public.room_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own room stats"
  ON public.room_members
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
