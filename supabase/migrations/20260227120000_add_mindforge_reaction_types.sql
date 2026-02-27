-- MindForge Reactions configuration table
CREATE TABLE IF NOT EXISTS public.reaction_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  animation_file TEXT NOT NULL,
  sound_file TEXT,
  trigger_condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  grade_restrictions INT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reaction_types_key ON public.reaction_types(key);
CREATE INDEX IF NOT EXISTS idx_reaction_types_active ON public.reaction_types(is_active);

ALTER TABLE public.reaction_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active reaction types"
ON public.reaction_types
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage reaction types"
ON public.reaction_types
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_reaction_types_updated_at
BEFORE UPDATE ON public.reaction_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.reaction_types (key, display_name, animation_file, sound_file, trigger_condition, grade_restrictions)
VALUES
  ('correct_basic', 'Correct Basic', 'mindforge/correct_basic.json', 'mindforge/victory-soft.mp3', '{"event":"quiz_answer","is_correct":true,"min_streak":1,"max_streak":2}'::jsonb, '{}'),
  ('correct_combo', 'Correct Combo', 'mindforge/correct_combo.json', 'mindforge/combo-rise.mp3', '{"event":"quiz_answer","is_correct":true,"min_streak":3,"max_streak":9}'::jsonb, '{}'),
  ('correct_power', 'Correct Power', 'mindforge/correct_power.json', 'mindforge/power-mode.mp3', '{"event":"quiz_answer","is_correct":true,"min_streak":10}'::jsonb, '{}'),
  ('wrong_growth', 'Wrong Growth', 'mindforge/wrong_growth.json', 'mindforge/growth-soft.mp3', '{"event":"quiz_answer","is_correct":false,"wrong_topic_count":1}'::jsonb, '{}'),
  ('tournament_win', 'Tournament Win', 'mindforge/tournament_win.json', 'mindforge/tournament-fanfare.mp3', '{"event":"tournament_end","placement":1}'::jsonb, '{}'),
  ('level_up', 'Level Up', 'mindforge/level_up.json', 'mindforge/level-up.mp3', '{"event":"level_up"}'::jsonb, '{}')
ON CONFLICT (key) DO NOTHING;
