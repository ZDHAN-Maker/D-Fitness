-- 003_user_tables.sql
-- USER-OWNED DATA: identity, settings, body, recovery, hydration, goals, streaks,
-- achievements, notifications. Every table here gets RLS in 008_rls.sql.
-- Authentication identity lives in auth.users (Supabase Auth is the source of truth).

create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  display_name         text,
  avatar_path          text,                                -- path inside private 'avatars' bucket
  birth_date           date check (birth_date is null or birth_date between date '1900-01-01' and current_date),
  sex                  text check (sex in ('male','female')),
  height_cm            numeric(5,1) check (height_cm is null or height_cm between 50 and 260),
  activity_level       text check (activity_level in ('sedentary','light','moderate','active','very_active')),
  experience_level     text check (experience_level in ('beginner','intermediate','advanced')),
  primary_goal         text check (primary_goal in ('lose_fat','build_muscle','maintain','improve_endurance','general_health')),
  timezone             text not null default 'Asia/Jakarta',
  unit_system          text not null default 'metric' check (unit_system in ('metric','imperial')),
  onboarding_completed boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.user_settings (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  theme                  text not null default 'system' check (theme in ('light','dark','system')),
  week_starts_on         smallint not null default 1 check (week_starts_on between 0 and 6),
  -- Daily targets. Calorie floor is a deliberate safety guard against extreme restriction.
  calorie_target         int  not null default 2000 check (calorie_target between 1200 and 8000),
  protein_target_g       int  not null default 120  check (protein_target_g between 0 and 600),
  carbs_target_g         int  not null default 250  check (carbs_target_g between 0 and 1200),
  fat_target_g           int  not null default 65   check (fat_target_g between 0 and 400),
  fiber_target_g         int  not null default 30   check (fiber_target_g between 0 and 200),
  water_target_ml        int  not null default 2500 check (water_target_ml between 500 and 10000),
  sleep_target_minutes   int  not null default 480  check (sleep_target_minutes between 240 and 840),
  weekly_workout_target  smallint not null default 3 check (weekly_workout_target between 0 and 14),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.user_preferences (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  dietary_restrictions  text[] not null default '{}',
  disliked_foods        text[] not null default '{}',
  preferred_cuisines    text[] not null default '{}',
  available_equipment   text[] not null default '{}',
  workout_days_per_week smallint check (workout_days_per_week between 1 and 7),
  session_minutes       smallint check (session_minutes between 10 and 240),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.notification_preferences (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  enabled             boolean not null default true,
  workout_reminders   boolean not null default true,
  nutrition_reminders boolean not null default true,
  hydration_reminders boolean not null default true,
  recovery_alerts     boolean not null default true,
  quiet_hours_start   time not null default '22:00',
  quiet_hours_end     time not null default '07:00',
  max_per_day         smallint not null default 3 check (max_per_day between 0 and 10),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.streaks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  streak_type        text not null check (streak_type in ('workout','nutrition','hydration','habit')),
  current_count      int not null default 0 check (current_count >= 0),
  longest_count      int not null default 0 check (longest_count >= 0),
  last_activity_date date,
  updated_at         timestamptz not null default now(),
  unique (user_id, streak_type)
);
comment on table public.streaks is
  'Incrementally maintained by public.update_streak(). A streak is considered broken at read time when last_activity_date < today - 1.';

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null,                              -- workout_reminder | protein_gap | hydration | recovery ...
  title         text not null,
  body          text,
  data          jsonb not null default '{}'::jsonb,
  dedupe_key    text,                                       -- e.g. 'protein_gap:2026-10-07' -> max one per key
  scheduled_for timestamptz,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

-- Body tracking ----------------------------------------------------------

create table public.weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  logged_on  date not null,
  weight_kg  numeric(5,2) not null check (weight_kg > 0 and weight_kg < 700),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create table public.body_measurements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  measured_on  date not null,
  waist_cm     numeric(5,1) check (waist_cm  > 0 and waist_cm  < 400),
  chest_cm     numeric(5,1) check (chest_cm  > 0 and chest_cm  < 400),
  arm_cm       numeric(5,1) check (arm_cm    > 0 and arm_cm    < 200),
  thigh_cm     numeric(5,1) check (thigh_cm  > 0 and thigh_cm  < 300),
  hip_cm       numeric(5,1) check (hip_cm    > 0 and hip_cm    < 400),
  body_fat_pct numeric(4,1) check (body_fat_pct >= 1 and body_fat_pct <= 70),
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, measured_on),
  check (num_nonnulls(waist_cm, chest_cm, arm_cm, thigh_cm, hip_cm, body_fat_pct) >= 1)
);

create table public.progress_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  taken_on     date not null,
  pose         text not null default 'front' check (pose in ('front','side','back','other')),
  storage_path text not null unique,                        -- inside private 'progress-photos' bucket; never the file itself
  mime_type    text,
  size_bytes   int check (size_bytes > 0),
  note         text,
  created_at   timestamptz not null default now(),
  -- storage objects are namespaced by user id; enforce the convention in the DB too
  check (storage_path like user_id::text || '/%')
);

-- Recovery & hydration ---------------------------------------------------

create table public.sleep_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  sleep_date       date not null,                           -- the date the user woke up
  duration_minutes int not null check (duration_minutes between 0 and 1440),
  quality          smallint check (quality between 1 and 5),
  bedtime          timestamptz,
  wake_time        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, sleep_date)
);

create table public.recovery_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  log_date       date not null,
  energy         smallint check (energy between 1 and 5),
  stress         smallint check (stress between 1 and 5),   -- 5 = very stressed
  soreness       smallint check (soreness between 1 and 5), -- 5 = very sore
  overall        smallint check (overall between 1 and 5),
  recovery_score numeric(5,2) check (recovery_score between 0 and 100),  -- computed server-side (lib/calculations)
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, log_date)
);

create table public.water_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  logged_on  date not null,                                 -- user-local date, supplied by the server
  logged_at  timestamptz not null default now(),
  amount_ml  int not null check (amount_ml > 0 and amount_ml <= 5000)
);

-- Goals --------------------------------------------------------------------

create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  template_id   bigint references public.goal_templates(id) on delete set null,
  goal_type     text not null check (goal_type in ('body','strength','running','nutrition','habit')),
  title         text not null,
  metric        text not null,
  direction     text not null default 'increase' check (direction in ('increase','decrease')),
  exercise_id   bigint references public.exercises(id) on delete set null,  -- for strength goals
  start_date    date not null default current_date,
  target_date   date,
  start_value   numeric,
  current_value numeric,
  target_value  numeric not null,
  unit          text,
  status        text not null default 'active' check (status in ('active','completed','paused','abandoned')),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (target_date is null or target_date >= start_date)
);

create table public.goal_progress (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references public.goals(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  recorded_on date not null,
  value       numeric not null,
  note        text,
  created_at  timestamptz not null default now()
);

create table public.user_achievements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  achievement_id bigint not null references public.achievement_definitions(id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  unique (user_id, achievement_id)
);
