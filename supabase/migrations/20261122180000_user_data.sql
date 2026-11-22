-- RoadDash: the user's work on the server (writings, feedback, email
-- exercises), onboarding choices on the profile, and scheduled cleanup.
--
-- Users can read their own rows. Writings, scores and analyses are written
-- only by the server (secret key): the server stores the text, scores the
-- stored text and writes the result, so nobody can give themselves a score.

-- ── Writings ────────────────────────────────────────────────────────────────

create table public.writings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('predetermined', 'random')),
  topic text not null check (char_length(topic) between 1 and 400),
  content text not null check (char_length(content) between 1 and 6000),
  word_count integer not null check (word_count >= 0),
  -- 'app': written in the app; 'import': brought over from the browser once.
  source text not null default 'app' check (source in ('app', 'import')),
  -- Id the browser gave the writing before the import (repeat imports skip it).
  local_id text check (char_length(local_id) <= 80),
  created_at timestamptz not null default now()
);

create index writings_user_created on public.writings (user_id, created_at desc);
create unique index writings_user_local on public.writings (user_id, local_id);

alter table public.writings enable row level security;

create policy "Users read their own writings"
  on public.writings for select to authenticated
  using ((select auth.uid()) = user_id);

-- One feedback per writing.
create table public.writing_feedback (
  writing_id uuid primary key references public.writings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  band_score numeric(3, 1) not null check (band_score between 0 and 9),
  grammar_score smallint not null check (grammar_score between 0 and 10),
  coherence_score smallint not null check (coherence_score between 0 and 10),
  vocabulary_score smallint not null check (vocabulary_score between 0 and 10),
  grammar_errors jsonb not null default '[]' check (jsonb_typeof(grammar_errors) = 'array'),
  suggestions jsonb not null default '[]' check (jsonb_typeof(suggestions) = 'array'),
  overall_comment text not null default '',
  -- 'ai': scored by the model; 'mock': sample scoring (development, no model);
  -- 'import': scored in the browser before the account existed.
  source text not null default 'ai' check (source in ('ai', 'mock', 'import')),
  model text,
  created_at timestamptz not null default now()
);

create index writing_feedback_user on public.writing_feedback (user_id);

alter table public.writing_feedback enable row level security;

create policy "Users read their own feedback"
  on public.writing_feedback for select to authenticated
  using ((select auth.uid()) = user_id);

-- ── Email exercises ─────────────────────────────────────────────────────────

create table public.email_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario_id text not null check (char_length(scenario_id) <= 80),
  category text not null check (char_length(category) <= 40),
  title_tr text not null default '' check (char_length(title_tr) <= 200),
  recipient text not null default '' check (char_length(recipient) <= 200),
  subject text not null default '' check (char_length(subject) <= 200),
  body text not null check (char_length(body) <= 6000),
  word_count integer not null check (word_count >= 0),
  -- Null until scored (or when scoring failed).
  analysis jsonb check (analysis is null or jsonb_typeof(analysis) = 'object'),
  analysis_source text check (analysis_source in ('ai', 'mock', 'import')),
  source text not null default 'app' check (source in ('app', 'import')),
  local_id text check (char_length(local_id) <= 80),
  created_at timestamptz not null default now()
);

create index email_exercises_user_created on public.email_exercises (user_id, created_at desc);
create unique index email_exercises_user_local on public.email_exercises (user_id, local_id);

alter table public.email_exercises enable row level security;

create policy "Users read their own email exercises"
  on public.email_exercises for select to authenticated
  using ((select auth.uid()) = user_id);

-- ── Onboarding choices on the profile ───────────────────────────────────────

-- Chosen exam, target score (TOEFL 0–6, IELTS 0–9) and the placement test
-- result. These are the user's own choices, so they may change them.
alter table public.profiles
  add column selected_exam text check (selected_exam in ('toefl', 'ielts')),
  add column target_score numeric(3, 1) check (target_score between 0 and 9),
  add column placement jsonb check (
    placement is null or (jsonb_typeof(placement) = 'object' and pg_column_size(placement) <= 4000)
  );

grant update (name, selected_exam, target_score, placement) on public.profiles to authenticated;

-- ── Scheduled cleanup (pg_cron) ─────────────────────────────────────────────

-- Daily counters older than 30 days and per-minute windows older than an
-- hour are no longer read. Scheduling under the same name again updates the job.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'roaddash-cleanup-usage',
  '15 3 * * *',
  $$delete from public.usage_daily where day < current_date - 30$$
);

select cron.schedule(
  'roaddash-cleanup-rate-limits',
  '7 * * * *',
  $$delete from public.rate_limits where window_start < now() - interval '1 hour'$$
);
