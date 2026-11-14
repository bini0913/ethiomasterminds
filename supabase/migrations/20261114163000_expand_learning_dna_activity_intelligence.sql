-- Extend the existing private Learning DNA report with verified activity aggregates and Grok insights.
alter table public.learning_dna
  add column if not exists activity_summary jsonb not null default '{}'::jsonb,
  add column if not exists ai_insights jsonb not null default '{}'::jsonb,
  add column if not exists data_coverage jsonb not null default '{}'::jsonb;

comment on column public.learning_dna.activity_summary is
  'Server-generated, per-user aggregates from verified Master Minds learning activity. Never client writable.';
comment on column public.learning_dna.ai_insights is
  'Grok-generated educational insights grounded in activity_summary. Never client writable.';
comment on column public.learning_dna.data_coverage is
  'Records which Learning DNA sources were available and any sampling limits.';
