-- Personalized Academic Mode setup
create table if not exists public.academic_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  grade integer not null check (grade between 5 and 12),
  study_goal text not null check (study_goal in ('class','ministry_exam','university_entrance','national_exam','custom')),
  study_goal_detail text,
  curriculum text not null check (curriculum in ('oromia','addis_ababa')),
  subjects text[] not null default '{}',
  book_id uuid references public.library_books(id) on delete set null,
  book_title text,
  onboarding_completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.academic_profiles enable row level security;

drop policy if exists "academic_profiles_select_own" on public.academic_profiles;
create policy "academic_profiles_select_own" on public.academic_profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "academic_profiles_insert_own" on public.academic_profiles;
create policy "academic_profiles_insert_own" on public.academic_profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "academic_profiles_update_own" on public.academic_profiles;
create policy "academic_profiles_update_own" on public.academic_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.academic_profiles to authenticated;
create index if not exists academic_profiles_book_id_idx on public.academic_profiles(book_id);
