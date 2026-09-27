-- Complete the Early KG-4 product layer: content catalog, achievements, video shelf,
-- adaptive recommendations, and parent-visible progress.

CREATE TABLE IF NOT EXISTS public.early_content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  subject text NOT NULL,
  skill text NOT NULL,
  grade_min integer NOT NULL DEFAULT 0,
  grade_max integer NOT NULL DEFAULT 4,
  activity_type text NOT NULL,
  difficulty integer NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  route text NOT NULL,
  icon text NOT NULL DEFAULT '⭐',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.early_video_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  subject text NOT NULL,
  grade_min integer NOT NULL DEFAULT 0,
  grade_max integer NOT NULL DEFAULT 4,
  provider text NOT NULL,
  url text NOT NULL,
  icon text NOT NULL DEFAULT '📺',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.early_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  requirement_type text NOT NULL,
  requirement_value integer NOT NULL,
  reward_xp integer NOT NULL DEFAULT 0,
  reward_coins integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.early_user_achievements (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.early_achievements(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  unlocked_at timestamptz,
  PRIMARY KEY (user_id, achievement_id)
);

ALTER TABLE public.early_content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.early_video_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.early_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.early_user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Early content is readable" ON public.early_content_items;
CREATE POLICY "Early content is readable" ON public.early_content_items FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Early videos are readable" ON public.early_video_resources;
CREATE POLICY "Early videos are readable" ON public.early_video_resources FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Early achievements are readable" ON public.early_achievements;
CREATE POLICY "Early achievements are readable" ON public.early_achievements FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Users read own Early achievements" ON public.early_user_achievements;
CREATE POLICY "Users read own Early achievements" ON public.early_user_achievements FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own Early achievements" ON public.early_user_achievements;
CREATE POLICY "Users insert own Early achievements" ON public.early_user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own Early achievements" ON public.early_user_achievements;
CREATE POLICY "Users update own Early achievements" ON public.early_user_achievements FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.early_content_items (activity_id,title,description,subject,skill,grade_min,grade_max,activity_type,difficulty,route,icon) VALUES
('number-quest','Number Quest','Counting, addition, and number sense adventures.','Math','number sense',0,4,'game',1,'/early-games','🔢'),
('word-match','Word Match','Pictures, letters, and early word recognition.','Reading','vocabulary',0,4,'game',1,'/early-games','🔤'),
('shape-hunt','Shape Hunt','Find and name shapes and build spatial thinking.','Math','shapes',0,4,'game',1,'/early-games','🔷'),
('pattern-builder','Pattern Builder','Predict what comes next in a pattern.','Math','patterns',0,4,'game',1,'/early-games','🧩'),
('memory-match','Memory Match','Build memory, attention, and recall.','Thinking','memory',0,4,'game',1,'/early-games','🧠'),
('odd-one-out','Odd One Out','Classify objects and spot differences.','Thinking','classification',0,4,'game',2,'/early-games','🕵️'),
('sort-safari','Sort Safari','Sort things into meaningful groups.','Thinking','classification',0,4,'game',2,'/early-games','🦁'),
('animal-detective','Animal Detective','Use science clues to identify animals.','Science','animals',0,4,'game',2,'/early-games','🔎'),
('word-builder','Word Builder','Practise first sounds and spelling.','Reading','phonics',0,4,'game',2,'/early-games','🧱'),
('coding-robot','Coding Robot','Practise sequencing and simple algorithms.','Coding','sequencing',0,4,'game',3,'/early-games','🤖')
ON CONFLICT (activity_id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,subject=EXCLUDED.subject,skill=EXCLUDED.skill,difficulty=EXCLUDED.difficulty,route=EXCLUDED.route,icon=EXCLUDED.icon;

INSERT INTO public.early_video_resources (title,description,subject,provider,url,icon) VALUES
('Math Adventures','Counting, shapes, patterns, and early math practice.','Math','Khan Academy Kids','https://www.khanacademy.org/kids','🔢'),
('Reading & Stories','Letters, sounds, words, stories, and read-aloud learning.','Reading','Khan Academy Kids','https://www.khanacademy.org/kids/ela','📚'),
('Science & Nature','Curiosity-led science, animals, nature, and discovery.','Science','PBS KIDS','https://www.pbs.org/parents/lets-play-games','🌱'),
('Creative Time','Stories, art, movement, and playful learning ideas.','Creative','Khan Academy Kids','https://www.khanacademy.org/kids','🎨')
ON CONFLICT DO NOTHING;

INSERT INTO public.early_achievements (key,name,description,icon,requirement_type,requirement_value,reward_xp,reward_coins) VALUES
('first-activity','First Adventure','Complete your first learning activity.','🌟','completions',1,10,5),
('five-activities','Five Adventures','Complete five learning activities.','🚀','completions',5,20,10),
('ten-activities','Ten Adventures','Complete ten learning activities.','🏆','completions',10,40,20),
('math-explorer','Math Explorer','Practise a math skill five times.','🔢','math_attempts',5,20,10),
('reading-star','Reading Star','Practise a reading skill five times.','📚','reading_attempts',5,20,10),
('science-explorer','Science Explorer','Practise a science skill three times.','🔬','science_attempts',3,15,8),
('coding-pioneer','Coding Pioneer','Practise coding three times.','🤖','coding_attempts',3,15,8),
('accuracy-star','Accuracy Star','Reach 80% accuracy after ten attempts.','🎯','accuracy_80',10,30,15),
('xp-hunter','XP Hunter','Earn 100 XP through Early learning.','✨','xp_earned',100,30,15)
ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,icon=EXCLUDED.icon,requirement_type=EXCLUDED.requirement_type,requirement_value=EXCLUDED.requirement_value,reward_xp=EXCLUDED.reward_xp,reward_coins=EXCLUDED.reward_coins;
