begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

select ok(not has_table_privilege('authenticated', 'public.profiles', 'update'), 'students have no table-wide profile UPDATE privilege');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'grade', 'update'), 'students cannot update grade directly');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'education_level', 'update'), 'students cannot update education tier directly');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'xp', 'update'), 'students cannot update XP directly');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'season_xp', 'update'), 'students cannot update season XP directly');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'level', 'update'), 'students cannot update level directly');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'account_status', 'update'), 'students cannot update account status directly');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'rank', 'update'), 'students cannot update rank directly');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'badges', 'update'), 'students cannot update badges directly');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'total_study_time', 'update'), 'students cannot update study time directly');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'created_at', 'update'), 'students cannot rewrite profile creation time');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'update'), 'students cannot forge profile update time');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'grade', 'insert'), 'students cannot seed grade through direct profile insert');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'xp', 'insert'), 'students cannot seed XP through direct profile insert');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'season_xp', 'insert'), 'students cannot seed season XP through direct profile insert');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'level', 'insert'), 'students cannot seed level through direct profile insert');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'account_status', 'insert'), 'students cannot seed account status through direct profile insert');
select ok(has_column_privilege('authenticated', 'public.profiles', 'name', 'update'), 'students can still edit their display name');
select ok(has_column_privilege('authenticated', 'public.profiles', 'avatar', 'update'), 'students can still edit their avatar');
select ok(has_function_privilege('authenticated', 'public.set_initial_student_grade(text)', 'execute'), 'students can use the validated first-grade setup RPC');
select ok(has_function_privilege('authenticated', 'public.admin_update_student_grade(uuid,text)', 'execute'), 'staff grade changes are routed through the protected RPC');

select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public'
    and tablename = 'profiles'
    and policyname = 'Users can update own editable profile fields'
    and coalesce(with_check, '') like '%auth.uid()%'
), 'profile update policy prevents changing row ownership');

select * from finish();
rollback;
