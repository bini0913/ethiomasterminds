-- CI-only fixtures. This file is executed only against an ephemeral local Supabase database.
-- Never run this seed against production.
begin;

do $$
declare
  v_user record;
  v_manager_membership uuid := '70000000-0000-4000-8000-000000000004';
  v_teacher_membership uuid := '70000000-0000-4000-8000-000000000002';
  v_student_membership uuid := '70000000-0000-4000-8000-000000000001';
  v_finance_membership uuid := '70000000-0000-4000-8000-000000000005';
  v_parent_membership uuid := '70000000-0000-4000-8000-000000000006';
  v_academic_membership uuid := '70000000-0000-4000-8000-000000000009';
  v_kg_membership uuid := '70000000-0000-4000-8000-000000000010';
  v_elementary_membership uuid := '70000000-0000-4000-8000-000000000011';
  v_middle_membership uuid := '70000000-0000-4000-8000-000000000012';
  v_high_membership uuid := '70000000-0000-4000-8000-000000000013';
  v_school_id uuid := '20000000-0000-4000-8000-000000000001';
  v_network_id uuid;
  v_year_id uuid := '30000000-0000-4000-8000-000000000001';
  v_section_id uuid := '40000000-0000-4000-8000-000000000001';
  v_term_id uuid := '50000000-0000-4000-8000-000000000001';
  v_subject_id uuid := '60000000-0000-4000-8000-000000000001';
  v_fee_id uuid := '80000000-0000-4000-8000-000000000001';
begin
  for v_user in
    select *
    from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'ci-student@masterminds.test', 'ci_student', 'CI Student', 16, '9', 'guardian-ci@masterminds.test', 'student'::public.app_role),
      ('00000000-0000-4000-8000-000000000002'::uuid, 'ci-teacher@masterminds.test', 'ci_teacher', 'CI Teacher', 25, null, null, 'teacher'::public.app_role),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'ci-admin@masterminds.test', 'ci_admin', 'CI Admin', 25, null, null, 'admin'::public.app_role),
      ('00000000-0000-4000-8000-000000000004'::uuid, 'ci-manager@masterminds.test', 'ci_manager', 'CI Manager', 25, null, null, 'manager'::public.app_role),
      ('00000000-0000-4000-8000-000000000005'::uuid, 'ci-finance@masterminds.test', 'ci_finance', 'CI Finance', 25, null, null, 'finance'::public.app_role),
      ('00000000-0000-4000-8000-000000000006'::uuid, 'ci-parent@masterminds.test', 'ci_parent', 'CI Parent', 35, null, null, 'parent'::public.app_role),
      ('00000000-0000-4000-8000-000000000007'::uuid, 'ci-super-admin@masterminds.test', 'ci_super_admin', 'CI Super Admin', 30, null, null, 'super_admin'::public.app_role),
      ('00000000-0000-4000-8000-000000000008'::uuid, 'ci-extreme-admin@masterminds.test', 'ci_extreme_admin', 'CI Extreme Admin', 30, null, null, 'extreme_admin'::public.app_role),
      ('00000000-0000-4000-8000-000000000009'::uuid, 'ci-academic-director@masterminds.test', 'ci_academic_director', 'CI Academic Director', 30, null, null, 'teacher'::public.app_role),
      ('00000000-0000-4000-8000-000000000010'::uuid, 'ci-kg-director@masterminds.test', 'ci_kg_director', 'CI KG Director', 30, null, null, 'teacher'::public.app_role),
      ('00000000-0000-4000-8000-000000000011'::uuid, 'ci-elementary-director@masterminds.test', 'ci_elementary_director', 'CI Elementary Director', 30, null, null, 'teacher'::public.app_role),
      ('00000000-0000-4000-8000-000000000012'::uuid, 'ci-middle-director@masterminds.test', 'ci_middle_director', 'CI Middle School Director', 30, null, null, 'teacher'::public.app_role),
      ('00000000-0000-4000-8000-000000000013'::uuid, 'ci-high-school-director@masterminds.test', 'ci_high_school_director', 'CI High School Director', 30, null, null, 'teacher'::public.app_role)
    ) as users(id,email,username,display_name,age,grade,guardian_email,role)
  loop
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config('request.jwt.claim.sub', v_user.id::text, true);

    insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    values (
      v_user.id,
      'authenticated',
      'authenticated',
      v_user.email,
      crypt('Local-Only-Test-Password-2026!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'name', v_user.display_name,
        'username', v_user.username,
        'age', v_user.age,
        'grade', v_user.grade,
        'guardian_email', v_user.guardian_email,
        'education_level', case when v_user.grade is not null then 'high_school' else null end,
        'avatar', 'avatar-1'
      ),
      now(),
      now()
    )
    on conflict (id) do nothing;

    delete from public.user_roles where user_id = v_user.id;
    insert into public.user_roles(user_id, role) values (v_user.id, v_user.role);
  end loop;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);

  select id into v_network_id
    from public.school_networks
   where network_key = true
   order by created_at
   limit 1;

  if v_network_id is null then
    v_network_id := '10000000-0000-4000-8000-000000000001';
    insert into public.school_networks(id, network_key, name, created_by)
    values (v_network_id, true, 'Master Minds CI Network', '00000000-0000-4000-8000-000000000004')
    on conflict do nothing;

    select id into v_network_id
      from public.school_networks
     where network_key = true
     order by created_at
     limit 1;
  end if;

  insert into public.schools(id, name, school_code, status, created_by, network_id)
  values (v_school_id, 'Master Minds CI Test School', 'CITEST01', 'active', '00000000-0000-4000-8000-000000000004', v_network_id)
  on conflict (id) do nothing;

  insert into public.school_academic_years(id, school_id, name, starts_on, ends_on, is_current)
  values (v_year_id, v_school_id, '2026 CI Academic Year', date '2026-01-01', date '2026-12-31', true)
  on conflict (id) do nothing;

  insert into public.school_memberships(id, school_id, user_id, school_role, status, age_at_enrollment, school_username, created_by)
  values
    (v_manager_membership, v_school_id, '00000000-0000-4000-8000-000000000004', 'manager', 'active', 25, 'ci_manager', '00000000-0000-4000-8000-000000000004'),
    (v_teacher_membership, v_school_id, '00000000-0000-4000-8000-000000000002', 'teacher', 'active', 25, 'ci_teacher', '00000000-0000-4000-8000-000000000004'),
    (v_finance_membership, v_school_id, '00000000-0000-4000-8000-000000000005', 'finance', 'active', 25, 'ci_finance', '00000000-0000-4000-8000-000000000004'),
    (v_parent_membership, v_school_id, '00000000-0000-4000-8000-000000000006', 'parent', 'active', 35, 'ci_parent', '00000000-0000-4000-8000-000000000004'),
    (v_academic_membership, v_school_id, '00000000-0000-4000-8000-000000000009', 'teacher', 'active', 30, 'ci_academic_director', '00000000-0000-4000-8000-000000000004'),
    (v_kg_membership, v_school_id, '00000000-0000-4000-8000-000000000010', 'teacher', 'active', 30, 'ci_kg_director', '00000000-0000-4000-8000-000000000004'),
    (v_elementary_membership, v_school_id, '00000000-0000-4000-8000-000000000011', 'teacher', 'active', 30, 'ci_elementary_director', '00000000-0000-4000-8000-000000000004'),
    (v_middle_membership, v_school_id, '00000000-0000-4000-8000-000000000012', 'teacher', 'active', 30, 'ci_middle_director', '00000000-0000-4000-8000-000000000004'),
    (v_high_membership, v_school_id, '00000000-0000-4000-8000-000000000013', 'teacher', 'active', 30, 'ci_high_school_director', '00000000-0000-4000-8000-000000000004')
  on conflict (id) do nothing;

  insert into public.school_sections(id, school_id, academic_year_id, grade_label, section_name, homeroom_teacher_id)
  values (v_section_id, v_school_id, v_year_id, 'Grade 9', 'A', v_teacher_membership)
  on conflict (id) do nothing;

  insert into public.school_memberships(id, school_id, user_id, school_role, status, grade_label, age_at_enrollment, section_id, student_number, school_username, created_by)
  values (v_student_membership, v_school_id, '00000000-0000-4000-8000-000000000001', 'student', 'active', 'Grade 9', 16, v_section_id, 9001, 'ci_student', '00000000-0000-4000-8000-000000000004')
  on conflict (id) do nothing;

  insert into public.school_subjects(id, school_id, academic_year_id, grade_label, subject_name, active, created_by)
  values (v_subject_id, v_school_id, v_year_id, 'Grade 9', 'Mathematics', true, '00000000-0000-4000-8000-000000000004')
  on conflict (id) do nothing;

  insert into public.school_terms(id, school_id, academic_year_id, name, term_number, starts_on, ends_on)
  values (v_term_id, v_school_id, v_year_id, 'CI Term 1', 1, date '2026-09-01', date '2026-12-31')
  on conflict (id) do nothing;

  insert into public.school_teacher_assignments(school_id, teacher_membership_id, section_id, subject_name, assignment_kind, created_by)
  values (v_school_id, v_teacher_membership, v_section_id, 'Mathematics', 'subject', '00000000-0000-4000-8000-000000000004')
  on conflict do nothing;

  insert into public.school_parent_student_links(school_id, parent_membership_id, student_membership_id, status, linked_by)
  values (v_school_id, v_parent_membership, v_student_membership, 'active', '00000000-0000-4000-8000-000000000004')
  on conflict do nothing;

  insert into public.school_division_grade_mappings(school_id, division_scope, grade_label, created_by_membership_id, updated_by_membership_id)
  values
    (v_school_id, 'kg', 'KG 1', v_manager_membership, v_manager_membership),
    (v_school_id, 'elementary', 'Grade 1', v_manager_membership, v_manager_membership),
    (v_school_id, 'middle_school', 'Grade 5', v_manager_membership, v_manager_membership),
    (v_school_id, 'high_school', 'Grade 9', v_manager_membership, v_manager_membership)
  on conflict do nothing;

  insert into public.school_leadership_appointments(
    school_id, membership_id, position, division_scope, permissions, status,
    start_date, appointed_by_membership_id, change_reason
  )
  values
    (v_school_id, v_academic_membership, 'academic_director', null, array['view_students','view_staff','view_attendance','review_attendance','view_academics','review_assessments','review_results','view_curriculum','view_reports'], 'active', current_date, v_manager_membership, 'CI fixture'),
    (v_school_id, v_kg_membership, 'kg_director', 'kg', array['view_students','view_staff','view_attendance','review_attendance','view_academics','review_assessments','review_results','view_curriculum','view_reports'], 'active', current_date, v_manager_membership, 'CI fixture'),
    (v_school_id, v_elementary_membership, 'elementary_director', 'elementary', array['view_students','view_staff','view_attendance','review_attendance','view_academics','review_assessments','review_results','view_curriculum','view_reports'], 'active', current_date, v_manager_membership, 'CI fixture'),
    (v_school_id, v_middle_membership, 'middle_school_director', 'middle_school', array['view_students','view_staff','view_attendance','review_attendance','view_academics','review_assessments','review_results','view_curriculum','view_reports'], 'active', current_date, v_manager_membership, 'CI fixture'),
    (v_school_id, v_high_membership, 'high_school_director', 'high_school', array['view_students','view_staff','view_attendance','review_attendance','view_academics','review_assessments','review_results','view_curriculum','view_reports'], 'active', current_date, v_manager_membership, 'CI fixture')
  on conflict do nothing;

  insert into public.school_fee_structures(id, school_id, academic_year_id, grade_label, fee_name, amount, currency, due_date, is_mandatory, active, created_by)
  values (v_fee_id, v_school_id, v_year_id, 'Grade 9', 'CI Tuition Fee', 1000, 'ETB', date '2026-12-31', true, true, '00000000-0000-4000-8000-000000000004')
  on conflict (id) do nothing;

  insert into public.school_student_invoices(
    school_id, fee_structure_id, student_membership_id, academic_year_id,
    invoice_number, description, amount, paid_amount, balance, currency, due_date, status, created_by
  )
  values (
    v_school_id, v_fee_id, v_student_membership, v_year_id,
    'CI-2026-0001', 'CI test tuition invoice', 1000, 0, 1000, 'ETB', date '2026-12-31', 'unpaid',
    '00000000-0000-4000-8000-000000000004'
  )
  on conflict do nothing;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end;
$$;

commit;
