-- Repair multiplayer readiness, public player identity, and question matching.
-- Additive/idempotent; preserves existing role and RLS hardening.

create or replace function public.get_public_student_profiles(p_user_ids uuid[])
returns table(
  id uuid,
  name text,
  username text,
  avatar text,
  level integer,
  xp integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.username, p.avatar, p.level, p.xp
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  where ur.role = 'student'
    and p.id = any(coalesce(p_user_ids, '{}'::uuid[]));
$$;

revoke all on function public.get_public_student_profiles(uuid[]) from public, anon;
grant execute on function public.get_public_student_profiles(uuid[]) to authenticated;

drop function if exists public.multiplayer_start_game(uuid);

create or replace function public.multiplayer_start_game(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.multiplayer_rooms%rowtype;
  v_players integer;
  v_unready integer;
  v_question_count integer;
  v_subject text;
  v_difficulty text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_room
  from public.multiplayer_rooms
  where id = p_room_id
  for update;

  if not found then raise exception 'Room not found'; end if;
  if v_room.host_id <> v_uid then raise exception 'Only the host can start the game'; end if;
  if v_room.status not in ('waiting', 'countdown') then
    raise exception 'Room is already started or finished';
  end if;

  select count(*) into v_players from public.room_players where room_id = p_room_id;
  if v_players < 2 then raise exception 'At least 2 players are required'; end if;

  select count(*) into v_unready
  from public.room_players
  where room_id = p_room_id
    and user_id <> v_room.host_id
    and coalesce(is_ready, false) = false;

  if v_unready > 0 then
    raise exception 'All other players must be ready before the host starts';
  end if;

  delete from public.room_answers where room_id = p_room_id;
  delete from public.room_questions where room_id = p_room_id;
  update public.room_players set score = 0 where room_id = p_room_id;

  v_question_count := greatest(1, least(coalesce(v_room.question_count, 10), 50));
  v_subject := lower(trim(coalesce(v_room.subject, 'mixed')));
  v_difficulty := lower(trim(coalesce(v_room.difficulty, 'medium')));

  insert into public.room_questions(room_id, question_id, order_index)
  select p_room_id, q.id, row_number() over (order by random()) - 1
  from public.questions q
  join public.quizzes qz on qz.id = q.quiz_id
  where qz.is_approved = true
    and (
      v_subject = 'mixed'
      or lower(trim(coalesce(qz.subject, ''))) = v_subject
      or (v_subject in ('math','mathematics')
          and lower(trim(coalesce(qz.subject, ''))) in ('math','mathematics'))
    )
    and (
      v_difficulty = 'mixed'
      or lower(trim(coalesce(qz.difficulty, ''))) = v_difficulty
    )
  order by random()
  limit v_question_count;

  -- Keep QA playable if a requested filter has no matching approved content.
  if not exists (select 1 from public.room_questions where room_id = p_room_id) then
    insert into public.room_questions(room_id, question_id, order_index)
    select p_room_id, q.id, row_number() over (order by random()) - 1
    from public.questions q
    join public.quizzes qz on qz.id = q.quiz_id
    where qz.is_approved = true
    order by random()
    limit v_question_count;
  end if;

  if not exists (select 1 from public.room_questions where room_id = p_room_id) then
    raise exception 'No approved questions are available for multiplayer';
  end if;

  insert into public.room_state(
    room_id,status,question_index,current_question_id,
    question_started_at,question_ends_at
  )
  values (p_room_id,'playing',0,null,null,null)
  on conflict (room_id) do update set
    status='playing',
    question_index=0,
    current_question_id=null,
    question_started_at=null,
    question_ends_at=null,
    updated_at=now();

  update public.multiplayer_rooms
  set status='playing', started_at=now(), finished_at=null, current_question=0
  where id=p_room_id;

  return true;
end;
$$;

grant execute on function public.multiplayer_start_game(uuid) to authenticated;

-- Seed a small QA bank only if the production database has no approved
-- Math/Medium questions. Existing approved questions are otherwise reused.
do $$
declare
  v_created_by uuid;
  v_quiz_id uuid;
  v_existing integer;
begin
  select count(*) into v_existing
  from public.questions q
  join public.quizzes qz on qz.id=q.quiz_id
  where qz.is_approved=true
    and lower(trim(coalesce(qz.subject,''))) in ('math','mathematics')
    and lower(trim(coalesce(qz.difficulty,'')))='medium';

  if v_existing > 0 then return; end if;

  select created_by into v_created_by
  from public.quizzes
  where created_by is not null
  order by created_at asc nulls last
  limit 1;

  if v_created_by is null then return; end if;

  select id into v_quiz_id
  from public.quizzes
  where title='Master Minds Multiplayer Test - Mathematics - Medium'
  limit 1;

  if v_quiz_id is null then
    insert into public.quizzes(
      created_by,title,description,subject,difficulty,grade,
      is_approved,is_public,time_limit,level_min,level_max,approved_at
    )
    values (
      v_created_by,
      'Master Minds Multiplayer Test - Mathematics - Medium',
      'QA question bank for multiplayer testing.',
      'Math','medium','5-8',true,true,30,5,12,now()
    )
    returning id into v_quiz_id;
  end if;

  insert into public.questions(
    quiz_id,question_text,question_type,options,correct_answer,
    option_a,option_b,option_c,option_d,points,difficulty,subject,grade,order_index
  )
  select v_quiz_id, x.question_text, 'multiple_choice', x.options, x.correct_answer,
         x.option_a,x.option_b,x.option_c,x.option_d,10,'medium','Math','5-8',x.order_index
  from (values
    ('What is 12 × 3?','["36","32","42","30"]'::jsonb,'36','36','32','42','30',1),
    ('What is 45 ÷ 5?','["9","8","10","7"]'::jsonb,'9','9','8','10','7',2),
    ('What is 25% of 80?','["20","15","25","30"]'::jsonb,'20','20','15','25','30',3),
    ('What is 7²?','["49","14","42","56"]'::jsonb,'49','49','14','42','56',4),
    ('What is 3/4 of 20?','["15","12","16","18"]'::jsonb,'15','15','12','16','18',5),
    ('What is 18 + 27?','["45","44","46","55"]'::jsonb,'45','45','44','46','55',6),
    ('What is 9 × 6?','["54","45","63","56"]'::jsonb,'54','54','45','63','56',7),
    ('What is 100 - 37?','["63","67","73","53"]'::jsonb,'63','63','67','73','53',8),
    ('What is 144 ÷ 12?','["12","10","14","16"]'::jsonb,'12','12','10','14','16',9),
    ('What is 2.5 + 1.5?','["4","3","4.5","5"]'::jsonb,'4','4','3','4.5','5',10)
  ) as x(question_text,options,correct_answer,option_a,option_b,option_c,option_d,order_index)
  where not exists (select 1 from public.questions q where q.quiz_id=v_quiz_id);
end;
$$;
