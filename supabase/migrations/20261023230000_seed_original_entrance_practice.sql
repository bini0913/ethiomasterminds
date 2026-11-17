-- Make quiz provenance fields available and seed an original entrance-style practice set.
-- These are newly authored practice questions, not copied historical exam items.
alter table public.quizzes
  add column if not exists source_kind text not null default 'topic_practice'
    check (source_kind in ('past_paper','topic_practice','generated_practice','teacher_authored')),
  add column if not exists source_name text,
  add column if not exists source_year integer,
  add column if not exists source_url text,
  add column if not exists source_verification_status text not null default 'unverified'
    check (source_verification_status in ('unverified','needs_review','verified','permission_confirmed'));
create index if not exists quizzes_source_kind_idx on public.quizzes (source_kind);

-- Exam Mode reads topic labels for topic coverage/progress tracking.
alter table public.questions add column if not exists topic text;

with owner as (
  select ur.user_id from public.user_roles ur
  where ur.role::text in ('admin','extreme_admin','teacher')
  order by case ur.role::text when 'admin' then 0 when 'extreme_admin' then 1 else 2 end limit 1
), inserted_quiz as (
  insert into public.quizzes
    (created_by,title,description,subject,grade,difficulty,time_limit,exam_type,is_approved,is_public,
     source_kind,source_name,source_year,source_url,source_verification_status)
  select owner.user_id,
    'Entrance Preparation: Mathematics Foundations (Original Practice)',
    'Original Master Minds practice questions for common Grade 12 entrance-exam skills. Not copied from or represented as any historical national exam.',
    'Mathematics','12','medium',20,'entrance_exam',true,true,
    'generated_practice','Master Minds original practice set',null,null,'unverified'
  from owner
  where not exists (select 1 from public.quizzes q where q.title='Entrance Preparation: Mathematics Foundations (Original Practice)' and q.grade='12')
  returning id
), target_quiz as (
  select id from inserted_quiz
  union all
  select q.id from public.quizzes q where q.title='Entrance Preparation: Mathematics Foundations (Original Practice)' and q.grade='12'
  limit 1
), question_seed(question_text,options,correct_answer,explanation,topic,order_index) as (
 values
 ('If 3x - 7 = 11, what is x?','["4","6","8","9"]'::jsonb,'6','Add 7 to both sides to get 3x = 18, then divide by 3.','Linear equations',1),
 ('What is the gradient of the line through (2, 3) and (6, 11)?','["1","2","3","4"]'::jsonb,'2','Gradient = (11 - 3) / (6 - 2) = 2.','Coordinate geometry',2),
 ('A fair six-sided die is rolled once. What is the probability of getting a prime number?','["1/6","1/3","1/2","2/3"]'::jsonb,'1/2','Prime outcomes are 2, 3, and 5: three of six equally likely outcomes.','Probability',3),
 ('Factor x² - 9 completely.','["(x - 9)(x + 1)","(x - 3)(x + 3)","(x - 3)²","(x + 9)(x - 1)"]'::jsonb,'(x - 3)(x + 3)','Use the difference of squares: a² - b² = (a - b)(a + b).','Algebraic expressions',4),
 ('The angles of a triangle are x, 2x, and 3x. What is the largest angle?','["30°","60°","90°","120°"]'::jsonb,'90°','The angles sum to 180°, so 6x = 180° and the largest is 3x = 90°.','Geometry',5),
 ('Simplify (2a³)(3a²).','["5a⁵","6a⁵","6a⁶","5a⁶"]'::jsonb,'6a⁵','Multiply coefficients and add exponents for the same base.','Indices',6),
 ('A vehicle travels 150 km in 3 hours at constant speed. What is its average speed?','["30 km/h","45 km/h","50 km/h","60 km/h"]'::jsonb,'50 km/h','Average speed = distance ÷ time = 150 ÷ 3 = 50 km/h.','Rates and motion',7),
 ('If f(x) = 2x² - 1, find f(3).','["5","11","17","18"]'::jsonb,'17','Substitute x = 3: 2(3²) - 1 = 17.','Functions',8),
 ('What is the sum of the first five positive integers?','["10","12","15","20"]'::jsonb,'15','1 + 2 + 3 + 4 + 5 = 15.','Sequences and series',9),
 ('A rectangle has perimeter 34 cm and length 10 cm. What is its width?','["5 cm","7 cm","12 cm","14 cm"]'::jsonb,'7 cm','2(L + W) = 34, so L + W = 17 and W = 7 cm.','Measurement',10),
 ('Solve the inequality 2x + 1 < 9.','["x < 3","x < 4","x > 4","x > 5"]'::jsonb,'x < 4','Subtract 1 to get 2x < 8, then divide by 2.','Inequalities',11),
 ('What is the median of 4, 9, 2, 7, 3?','["3","4","5","7"]'::jsonb,'4','Ordered values are 2, 3, 4, 7, 9; the middle value is 4.','Statistics',12)
)
insert into public.questions
 (quiz_id,question_text,options,correct_answer,explanation,topic,order_index,points,question_type,subject,grade,difficulty)
select tq.id,s.question_text,s.options,s.correct_answer,s.explanation,s.topic,s.order_index,10,'multiple_choice','Mathematics','12','medium'
from target_quiz tq cross join question_seed s
where not exists (select 1 from public.questions e where e.quiz_id=tq.id and e.order_index=s.order_index);

comment on column public.quizzes.source_kind is 'Content category; past_paper is a label, not proof of official provenance.';
comment on column public.quizzes.source_verification_status is 'Source/rights verification state; unverified content must not be presented as an official past paper.';
