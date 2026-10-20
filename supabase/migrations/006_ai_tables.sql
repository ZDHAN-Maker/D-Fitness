-- 006_ai_tables.sql
-- AI layer. AI output is stored separately from facts: `facts` columns hold values
-- computed from the database, free-text / recommendation columns hold model output.

create table public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  feature    text not null check (feature in ('coach','meal_assistant','workout_generator')),
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  metadata        jsonb not null default '{}'::jsonb,       -- model, token counts, data snapshot refs
  created_at      timestamptz not null default now()
);

create table public.ai_insights (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  insight_date    date not null,
  kind            text not null,                             -- daily | nutrition | training | recovery
  facts           jsonb not null default '{}'::jsonb,        -- DATABASE FACTS
  recommendation  text not null,                             -- AI RECOMMENDATION
  missing_data    text[] not null default '{}',              -- data the AI said it did not have
  model           text,
  created_at      timestamptz not null default now()
);

create table public.ai_food_scans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  storage_path   text not null,                              -- private 'food-scans' bucket
  status         text not null default 'pending'
                 check (status in ('pending','analyzed','confirmed','discarded','failed')),
  detected_items jsonb not null default '[]'::jsonb,         -- raw AI detections (UNTRUSTED)
  matched_items  jsonb not null default '[]'::jsonb,         -- DB matches proposed to the user
  model          text,
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now(),
  check (storage_path like user_id::text || '/%')
);

alter table public.food_log_items
  add constraint food_log_items_ai_scan_fk
  foreign key (ai_scan_id) references public.ai_food_scans(id) on delete set null;

create table public.ai_generated_workouts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  prompt        text not null,
  params        jsonb not null default '{}'::jsonb,          -- time, goal, equipment, recovery snapshot
  result        jsonb not null,
  plan_id       uuid references public.workout_plans(id) on delete set null,   -- set when added to a plan
  model         text,
  created_at    timestamptz not null default now()
);

create table public.ai_weekly_reviews (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  week_start         date not null,
  week_end           date not null,
  metrics            jsonb not null default '{}'::jsonb,     -- DATABASE FACTS (workouts, kcal, protein, water, sleep, weight)
  went_well          text,
  needs_improvement  text,
  recommendations    text,
  model              text,
  created_at         timestamptz not null default now(),
  unique (user_id, week_start),
  check (week_end >= week_start)
);

-- Written by server code only (service role) so users cannot reset their own rate limits.
create table public.ai_usage_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  feature       text not null,
  model         text,
  input_tokens  int check (input_tokens >= 0),
  output_tokens int check (output_tokens >= 0),
  created_at    timestamptz not null default now()
);
