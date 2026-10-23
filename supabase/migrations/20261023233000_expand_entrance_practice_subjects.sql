-- Expand the original entrance-style practice bank with additional Grade 12 subjects.
-- All items below are newly authored practice, not copied from historical national papers.
alter table public.quizzes
  add column if not exists source_kind text not null default 'topic_practice'
    check (source_kind in ('past_paper','topic_practice','generated_practice','teacher_authored')),
  add column if not exists source_name text,
  add column if not exists source_year integer,
  add column if not exists source_url text,
  add column if not exists source_verification_status text not null default 'unverified'
    check (source_verification_status in ('unverified','needs_review','verified','permission_confirmed'));
alter table public.questions add column if not exists topic text;

with owner as (
  select ur.user_id
  from public.user_roles ur
  where ur.role::text in ('admin','extreme_admin','teacher')
  order by case ur.role::text when 'admin' then 0 when 'extreme_admin' then 1 else 2 end
  limit 1
), quiz_seed(title, description, subject) as (
  values
    ('Entrance Preparation: English Skills (Original Practice)',
     'Original Grade 12 entrance-style English practice. Not a historical national exam paper.',
     'English'),
    ('Entrance Preparation: Physics Foundations (Original Practice)',
     'Original Grade 12 entrance-style Physics practice. Not a historical national exam paper.',
     'Physics'),
    ('Entrance Preparation: Biology Foundations (Original Practice)',
     'Original Grade 12 entrance-style Biology practice. Not a historical national exam paper.',
     'Biology')
)
insert into public.quizzes
  (created_by,title,description,subject,grade,difficulty,time_limit,exam_type,is_approved,is_public,
   source_kind,source_name,source_year,source_url,source_verification_status)
select owner.user_id, s.title, s.description, s.subject, '12', 'medium', 15,
       'entrance_practice', true, true, 'generated_practice',
       'Master Minds original practice set', null, null, 'unverified'
from owner cross join quiz_seed s
where not exists (
  select 1 from public.quizzes q where q.title=s.title and q.grade='12'
);

with quiz_lookup as (
  select q.id, q.title
  from public.quizzes q
  where q.grade='12' and q.title in (
    'Entrance Preparation: English Skills (Original Practice)',
    'Entrance Preparation: Physics Foundations (Original Practice)',
    'Entrance Preparation: Biology Foundations (Original Practice)'
  )
), question_seed(quiz_title, question_text, options, correct_answer, explanation, topic, order_index) as (
  values
  ('Entrance Preparation: English Skills (Original Practice)','Choose the word closest in meaning to “brief”.','["lengthy","concise","uncertain","distant"]'::jsonb,'concise','Brief means short in duration or concise in wording.','Vocabulary',1),
  ('Entrance Preparation: English Skills (Original Practice)','Choose the grammatically correct sentence.','["She have finished her work.","She has finished her work.","She finishing her work.","She finish her work yesterday."]'::jsonb,'She has finished her work.','The third-person singular subject “she” takes “has” in the present perfect.','Grammar',2),
  ('Entrance Preparation: English Skills (Original Practice)','If it rains tomorrow, we ___ at home.','["stayed","would stayed","will stay","staying"]'::jsonb,'will stay','A likely future condition commonly uses present simple in the if-clause and “will” in the main clause.','Conditionals',3),
  ('Entrance Preparation: English Skills (Original Practice)','Identify the passive form of “The committee approved the plan.”','["The plan approved the committee.","The plan was approved by the committee.","The committee was approved by the plan.","The plan has approving the committee."]'::jsonb,'The plan was approved by the committee.','The object becomes the subject; past simple passive uses “was” plus past participle.','Voice',4),
  ('Entrance Preparation: English Skills (Original Practice)','What is the main purpose of a topic sentence in a paragraph?','["To introduce its central idea","To list every source","To repeat the conclusion","To provide unrelated details"]'::jsonb,'To introduce its central idea','A topic sentence states the main point developed by the paragraph.','Reading and writing',5),
  ('Entrance Preparation: English Skills (Original Practice)','Choose the correct reported speech: He said, “I am tired.”','["He said that I am tired.","He said that he was tired.","He says that he tired.","He said he is tiring."]'::jsonb,'He said that he was tired.','In standard backshifted reported speech, “am” becomes “was” and the pronoun changes to match the speaker.','Reported speech',6),

  ('Entrance Preparation: Physics Foundations (Original Practice)','A 4 kg object accelerates at 3 m/s². What is the net force?','["7 N","12 N","1.33 N","24 N"]'::jsonb,'12 N','Newton’s second law gives F = ma = 4 × 3 = 12 N.','Newton laws',1),
  ('Entrance Preparation: Physics Foundations (Original Practice)','Which unit measures electric current?','["Volt","Ohm","Ampere","Watt"]'::jsonb,'Ampere','The ampere (A) is the SI unit of electric current.','Electricity',2),
  ('Entrance Preparation: Physics Foundations (Original Practice)','A wave has frequency 5 Hz and wavelength 2 m. What is its speed?','["2.5 m/s","7 m/s","10 m/s","20 m/s"]'::jsonb,'10 m/s','Wave speed v = fλ = 5 × 2 = 10 m/s.','Waves',3),
  ('Entrance Preparation: Physics Foundations (Original Practice)','How much work is done when a 10 N force moves an object 3 m in the force direction?','["3 J","13 J","30 J","300 J"]'::jsonb,'30 J','Work for a constant force in the direction of motion is W = Fd = 10 × 3 = 30 J.','Work and energy',4),
  ('Entrance Preparation: Physics Foundations (Original Practice)','Which component stores energy in an electric field?','["Resistor","Capacitor","Fuse","Switch"]'::jsonb,'Capacitor','A capacitor stores energy in the electric field between its conductors.','Electric circuits',5),
  ('Entrance Preparation: Physics Foundations (Original Practice)','An object travels 60 m in 12 s at constant speed. What is its speed?','["5 m/s","6 m/s","12 m/s","72 m/s"]'::jsonb,'5 m/s','Speed = distance ÷ time = 60 ÷ 12 = 5 m/s.','Motion',6),

  ('Entrance Preparation: Biology Foundations (Original Practice)','Which organelle is the main site of aerobic respiration in eukaryotic cells?','["Ribosome","Mitochondrion","Golgi apparatus","Vacuole"]'::jsonb,'Mitochondrion','Mitochondria generate most ATP during aerobic cellular respiration.','Cell biology',1),
  ('Entrance Preparation: Biology Foundations (Original Practice)','Which molecule carries hereditary information in most organisms?','["Starch","DNA","Cellulose","Glycogen"]'::jsonb,'DNA','DNA stores genetic information in most living organisms.','Genetics',2),
  ('Entrance Preparation: Biology Foundations (Original Practice)','Which blood cells are primarily responsible for oxygen transport?','["Platelets","Red blood cells","White blood cells","Lymphocytes only"]'::jsonb,'Red blood cells','Haemoglobin in red blood cells binds and transports oxygen.','Human physiology',3),
  ('Entrance Preparation: Biology Foundations (Original Practice)','In plants, which tissue transports water from roots toward leaves?','["Phloem","Xylem","Epidermis","Cortex only"]'::jsonb,'Xylem','Xylem conducts water and dissolved minerals from roots through the plant.','Plant transport',4),
  ('Entrance Preparation: Biology Foundations (Original Practice)','Which process produces genetically varied gametes through reduction division?','["Mitosis","Meiosis","Binary fission","Budding"]'::jsonb,'Meiosis','Meiosis halves chromosome number and creates variation through recombination and independent assortment.','Cell division',5),
  ('Entrance Preparation: Biology Foundations (Original Practice)','What is the role of decomposers in an ecosystem?','["They stop nutrient cycling","They recycle nutrients from dead matter","They make sunlight","They remove all producers"]'::jsonb,'They recycle nutrients from dead matter','Decomposers break down organic material and return nutrients to the ecosystem.','Ecology',6)
)
insert into public.questions
  (quiz_id,question_text,options,correct_answer,explanation,topic,order_index,points,question_type,subject,grade,difficulty)
select q.id, s.question_text, s.options, s.correct_answer, s.explanation, s.topic, s.order_index,
       10, 'multiple_choice',
       case when q.title like '%English Skills%' then 'English'
            when q.title like '%Physics Foundations%' then 'Physics'
            else 'Biology' end,
       '12','medium'
from question_seed s
join quiz_lookup q on q.title=s.quiz_title
where not exists (
  select 1 from public.questions existing
  where existing.quiz_id=q.id and existing.order_index=s.order_index
);
