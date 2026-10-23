-- Add explicit provenance to approved quiz sets without changing the existing question/result flow.
-- Existing past-paper tags are not proof that the paper is official or that its key is verified.
alter table public.quizzes
  add column if not exists source_kind text not null default 'topic_practice'
    check (source_kind in ('past_paper','topic_practice','generated_practice','teacher_authored')),
  add column if not exists source_name text,
  add column if not exists source_year integer,
  add column if not exists source_url text,
  add column if not exists source_verification_status text not null default 'unverified'
    check (source_verification_status in ('unverified','needs_review','verified','permission_confirmed'));

-- Preserve existing behavior while carrying forward old labels as unverified metadata.
update public.quizzes
set source_kind = case when exam_type = 'past_paper' then 'past_paper' else 'topic_practice' end
where source_kind = 'topic_practice';

update public.quizzes
set source_verification_status = 'unverified'
where source_verification_status is null;

create index if not exists quizzes_source_kind_idx on public.quizzes (source_kind);
comment on column public.quizzes.source_kind is 'Content category; past_paper is a label, not proof of official provenance.';
comment on column public.quizzes.source_verification_status is 'Verification of source/rights; do not label unverified content as an official past paper.';
