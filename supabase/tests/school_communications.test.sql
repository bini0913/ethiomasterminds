begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select ok(to_regclass('public.school_announcements') is not null, 'school announcements table exists');
select ok(to_regclass('public.school_announcement_reads') is not null, 'announcement read tracking exists');
select ok(to_regclass('public.school_conversations') is not null, 'school conversations table exists');
select ok(to_regclass('public.school_conversation_participants') is not null, 'conversation participants table exists');
select ok(to_regclass('public.school_messages') is not null, 'school messages table exists');
select ok(to_regclass('public.school_message_reads') is not null, 'message read tracking exists');

select ok((select relrowsecurity from pg_class where oid='public.school_announcements'::regclass), 'announcements have RLS');
select ok((select relrowsecurity from pg_class where oid='public.school_conversations'::regclass), 'conversations have RLS');
select ok((select relrowsecurity from pg_class where oid='public.school_messages'::regclass), 'messages have RLS');
select ok(not has_table_privilege('authenticated','public.school_conversations','INSERT'), 'conversation creation must use the guarded RPC');
select ok(not has_table_privilege('authenticated','public.school_conversation_participants','INSERT'), 'participants cannot be added outside the guarded RPC');
select ok(has_table_privilege('authenticated','public.school_messages','INSERT'), 'permitted participants can send messages through RLS');

select ok(has_function_privilege('authenticated','public.school_create_conversation(uuid,text,uuid,uuid,uuid[],text)','execute'), 'school conversations can be created through the scoped RPC');
select ok(has_function_privilege('authenticated','public.school_can_access_conversation(uuid)','execute'), 'conversation access is checked by school scope');
select ok(has_function_privilege('authenticated','public.school_can_send_message(uuid)','execute'), 'message sending is checked by role and relationship');
select ok(has_function_privilege('authenticated','public.school_submit_announcement(uuid)','execute'), 'teachers can submit class announcements');
select ok(has_function_privilege('authenticated','public.school_review_announcement(uuid,boolean,text)','execute'), 'School Admin can review announcements');

select ok(exists (select 1 from pg_trigger where tgname='school_announcement_notify_parents' and tgrelid='public.school_announcements'::regclass and not tgisinternal), 'parents are notified when announcements are published');
select ok(exists (select 1 from pg_trigger where tgname='school_message_notify_parent' and tgrelid='public.school_messages'::regclass and not tgisinternal), 'parents are notified about relevant messages');
select ok(exists (select 1 from pg_trigger where tgname='school_message_update_conversation' and tgrelid='public.school_messages'::regclass and not tgisinternal), 'conversation activity updates when messages arrive');

select * from finish();
rollback;
