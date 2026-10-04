-- Multiplayer modes v2: independent player progress and lower network chatter.
alter table public.room_players
  add column if not exists current_question_index integer not null default 0,
  add column if not exists answered_count integer not null default 0,
  add column if not exists correct_count integer not null default 0;
create index if not exists room_players_room_progress_idx on public.room_players(room_id,current_question_index);

create or replace function public.multiplayer_question_payload(p_room_id uuid,p_order_index integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare q record; n integer;
begin
  if auth.uid() is null or not exists(select 1 from public.room_players where room_id=p_room_id and user_id=auth.uid()) then raise exception 'Not a room player'; end if;
  select count(*)::int into n from public.room_questions where room_id=p_room_id;
  select x.id,x.question_text,x.options,x.points,r.order_index into q
  from public.room_questions r join public.questions x on x.id=r.question_id
  where r.room_id=p_room_id and r.order_index=p_order_index limit 1;
  if not found then return jsonb_build_object('done',true,'index',p_order_index,'total',n); end if;
  return jsonb_build_object('done',false,'id',q.id,'question_text',q.question_text,'options',q.options,'points',coalesce(q.points,100),'index',q.order_index,'total',n);
end $$;
revoke all on function public.multiplayer_question_payload(uuid,integer) from public,anon;
grant execute on function public.multiplayer_question_payload(uuid,integer) to authenticated;

create or replace function public.multiplayer_start_game(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r public.multiplayer_rooms%rowtype; uid uuid:=auth.uid(); n int; mode text;
begin
  select * into r from public.multiplayer_rooms where id=p_room_id for update;
  if uid is null then raise exception 'Authentication required'; end if;
  if not found then raise exception 'Room not found'; end if;
  if r.host_id<>uid then raise exception 'Only the host can start the game'; end if;
  if r.status not in ('waiting','countdown') then raise exception 'Room is already started or finished'; end if;
  if (select count(*) from public.room_players where room_id=p_room_id)<2 then raise exception 'At least 2 players are required'; end if;
  if exists(select 1 from public.room_players where room_id=p_room_id and user_id<>r.host_id and coalesce(is_ready,false)=false) then raise exception 'All other players must be ready before the host starts'; end if;
  mode:=case when lower(coalesce(r.game_mode,'accuracy')) in ('speed','one_minute','1_minute') then 'speed' else 'accuracy' end;
  n:=case when mode='speed' then 50 else greatest(1,least(coalesce(r.question_count,10),50)) end;
  delete from public.room_answers where room_id=p_room_id;
  delete from public.room_questions where room_id=p_room_id;
  insert into public.room_questions(room_id,question_id,order_index)
  select p_room_id,q.id,row_number() over(order by random())-1
  from public.questions q join public.quizzes z on z.id=q.quiz_id
  where z.is_approved=true and (lower(trim(coalesce(r.subject,'mixed')))= 'mixed' or lower(trim(coalesce(z.subject,'')))=lower(trim(coalesce(r.subject,'mixed'))) or (lower(trim(coalesce(r.subject,''))) in ('math','mathematics') and lower(trim(coalesce(z.subject,''))) in ('math','mathematics')))
  order by random() limit n;
  if (select count(*) from public.room_questions where room_id=p_room_id)<n then
    delete from public.room_questions where room_id=p_room_id;
    insert into public.room_questions(room_id,question_id,order_index)
    select p_room_id,q.id,row_number() over(order by random())-1 from public.questions q join public.quizzes z on z.id=q.quiz_id where z.is_approved=true order by random() limit n;
  end if;
  if not exists(select 1 from public.room_questions where room_id=p_room_id) then raise exception 'No approved questions are available for multiplayer'; end if;
  update public.multiplayer_rooms set status='playing',started_at=clock_timestamp(),finished_at=null,current_question=0,question_count=(select count(*) from public.room_questions where room_id=p_room_id),game_mode=mode where id=p_room_id;
  update public.room_players set score=0,current_question_index=0,answered_count=0,correct_count=0 where room_id=p_room_id;
  insert into public.room_state(room_id,status,question_index,current_question_id,question_started_at,question_ends_at) values(p_room_id,'playing',0,null,null,null)
  on conflict(room_id) do update set status='playing',question_index=0,current_question_id=null,question_started_at=null,question_ends_at=null,updated_at=clock_timestamp();
  return jsonb_build_object('status','playing','game_mode',mode,'question_count',(select count(*) from public.room_questions where room_id=p_room_id),'started_at',(select started_at from public.multiplayer_rooms where id=p_room_id));
end $$;
grant execute on function public.multiplayer_start_game(uuid) to authenticated;

create or replace function public.multiplayer_get_current_question(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare p public.room_players%rowtype; r public.multiplayer_rooms%rowtype;
begin
  select * into p from public.room_players where room_id=p_room_id and user_id=auth.uid();
  if not found then raise exception 'Not a room player'; end if;
  select * into r from public.multiplayer_rooms where id=p_room_id;
  if r.game_mode='speed' and r.status='playing' and r.started_at is not null and clock_timestamp()>=r.started_at+interval '1 minute' then
    update public.multiplayer_rooms set status='finished',finished_at=clock_timestamp() where id=p_room_id;
    update public.room_state set status='finished',updated_at=clock_timestamp() where room_id=p_room_id;
    return jsonb_build_object('done',true,'expired',true);
  end if;
  return public.multiplayer_question_payload(p_room_id,p.current_question_index);
end $$;
revoke all on function public.multiplayer_get_current_question(uuid) from public,anon;
grant execute on function public.multiplayer_get_current_question(uuid) to authenticated;

create or replace function public.multiplayer_submit_answer(p_room_id uuid,p_question_id uuid,p_answer text,p_time_used integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r public.multiplayer_rooms%rowtype; p public.room_players%rowtype; q public.questions%rowtype; rq public.room_questions%rowtype; ok boolean; pts int;
begin
  select * into r from public.multiplayer_rooms where id=p_room_id;
  if r.status<>'playing' then raise exception 'Match is not playing'; end if;
  if r.game_mode='speed' and r.started_at is not null and clock_timestamp()>=r.started_at+interval '1 minute' then
    update public.multiplayer_rooms set status='finished',finished_at=clock_timestamp() where id=p_room_id;
    update public.room_state set status='finished',updated_at=clock_timestamp() where room_id=p_room_id;
    return jsonb_build_object('finished',true);
  end if;
  select * into p from public.room_players where room_id=p_room_id and user_id=auth.uid() for update;
  if not found then raise exception 'Not a room player'; end if;
  select * into rq from public.room_questions where room_id=p_room_id and question_id=p_question_id and order_index=p.current_question_index;
  if not found then raise exception 'That is not your current question'; end if;
  if exists(select 1 from public.room_answers where room_id=p_room_id and user_id=auth.uid() and question_id=p_question_id) then raise exception 'Question already answered'; end if;
  select * into q from public.questions where id=p_question_id;
  ok:=lower(trim(coalesce(p_answer,'')))=lower(trim(coalesce(q.correct_answer,'')));
  pts:=case when ok then 100 else 0 end;
  insert into public.room_answers(room_id,user_id,question_id,answer,is_correct,points,time_used) values(p_room_id,auth.uid(),p_question_id,p_answer,ok,pts,greatest(0,coalesce(p_time_used,0)));
  update public.room_players set score=score+pts,answered_count=answered_count+1,correct_count=correct_count+case when ok then 1 else 0 end,current_question_index=case when r.game_mode='speed' then current_question_index+1 else current_question_index end where id=p.id;
  return jsonb_build_object('is_correct',ok,'points',pts,'game_mode',r.game_mode,'answered_count',p.answered_count+1,'correct_count',p.correct_count+case when ok then 1 else 0 end);
end $$;
grant execute on function public.multiplayer_submit_answer(uuid,uuid,text,integer) to authenticated;

create or replace function public.multiplayer_advance_player(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare p public.room_players%rowtype; total int; next_i int;
begin
  select * into p from public.room_players where room_id=p_room_id and user_id=auth.uid() for update;
  if not found then raise exception 'Not a room player'; end if;
  select count(*)::int into total from public.room_questions where room_id=p_room_id;
  next_i:=p.current_question_index+1;
  update public.room_players set current_question_index=next_i where id=p.id;
  if next_i>=total then
    if not exists(select 1 from public.room_players where room_id=p_room_id and current_question_index<total) then
      update public.multiplayer_rooms set status='finished',finished_at=clock_timestamp() where id=p_room_id;
      update public.room_state set status='finished',updated_at=clock_timestamp() where room_id=p_room_id;
    end if;
    return jsonb_build_object('done',true,'completed',true,'index',next_i,'total',total);
  end if;
  return public.multiplayer_question_payload(p_room_id,next_i);
end $$;
revoke all on function public.multiplayer_advance_player(uuid) from public,anon;
grant execute on function public.multiplayer_advance_player(uuid) to authenticated;

create or replace function public.multiplayer_finish_game(p_room_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare r public.multiplayer_rooms%rowtype; total int;
begin
  if not exists(select 1 from public.room_players where room_id=p_room_id and user_id=auth.uid()) then raise exception 'Not a room player'; end if;
  select * into r from public.multiplayer_rooms where id=p_room_id;
  select count(*)::int into total from public.room_questions where room_id=p_room_id;
  if (r.game_mode='speed' and r.started_at is not null and clock_timestamp()>=r.started_at+interval '1 minute') or (r.game_mode='accuracy' and not exists(select 1 from public.room_players where room_id=p_room_id and current_question_index<total)) then
    update public.multiplayer_rooms set status='finished',finished_at=clock_timestamp() where id=p_room_id;
    update public.room_state set status='finished',updated_at=clock_timestamp() where room_id=p_room_id;
    return true;
  end if;
  return false;
end $$;
revoke all on function public.multiplayer_finish_game(uuid) from public,anon;
grant execute on function public.multiplayer_finish_game(uuid) to authenticated;