-- Persist per-user textbook analysis so Topic Coverage and Study Planner share it across devices.
create table if not exists public.academic_book_analyses (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.library_books(id) on delete cascade,
  units jsonb not null default '[]'::jsonb,
  page_count integer not null default 0 check (page_count >= 0),
  method text not null default 'estimated' check (method in ('headings', 'page-ranges', 'estimated')),
  message text,
  analyzed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id),
  constraint academic_book_analyses_units_array check (jsonb_typeof(units) = 'array')
);
alter table public.academic_book_analyses enable row level security;
drop policy if exists "Users can read their own book analyses" on public.academic_book_analyses;
create policy "Users can read their own book analyses" on public.academic_book_analyses for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create their own book analyses" on public.academic_book_analyses;
create policy "Users can create their own book analyses" on public.academic_book_analyses for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own book analyses" on public.academic_book_analyses;
create policy "Users can update their own book analyses" on public.academic_book_analyses for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own book analyses" on public.academic_book_analyses;
create policy "Users can delete their own book analyses" on public.academic_book_analyses for delete to authenticated using (auth.uid() = user_id);
create index if not exists academic_book_analyses_book_id_idx on public.academic_book_analyses (book_id);
