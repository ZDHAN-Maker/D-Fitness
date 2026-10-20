-- 004_workout_tables.sql
-- Workout plans, sessions, sets, personal records and cardio/activity logs.

create table public.workout_plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  description    text,
  scheduled_days smallint[] not null default '{}',          -- 0=Sun..6=Sat
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.workout_plan_exercises (
  id                  uuid primary key default gen_random_uuid(),
  plan_id             uuid not null references public.workout_plans(id) on delete cascade,
  exercise_id         bigint not null references public.exercises(id) on delete restrict,
  position            int not null check (position >= 0),    -- drag & drop ordering
  target_sets         smallint not null default 3 check (target_sets between 1 and 20),
  target_reps_min     smallint check (target_reps_min > 0),
  target_reps_max     smallint check (target_reps_max >= target_reps_min),
  target_duration_sec int check (target_duration_sec > 0),
  target_weight_kg    numeric(6,2) check (target_weight_kg >= 0),
  rest_seconds        int check (rest_seconds between 0 and 1800),
  notes               text,
  unique (plan_id, position) deferrable initially deferred
);

create table public.workout_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  plan_id         uuid references public.workout_plans(id) on delete set null,
  name            text not null,
  status          text not null default 'in_progress' check (status in ('in_progress','completed','cancelled')),
  logged_on       date not null,                              -- user-local date
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  notes           text,
  total_volume_kg numeric(12,2) check (total_volume_kg >= 0),  -- cached on completion
  perceived_effort numeric(3,1) check (perceived_effort between 1 and 10),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
-- At most one active workout per user.
create unique index workout_sessions_one_active_per_user
  on public.workout_sessions (user_id) where status = 'in_progress';

create table public.workout_session_exercises (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id bigint not null references public.exercises(id) on delete restrict,
  position    int not null check (position >= 0),
  notes       text,
  unique (session_id, position) deferrable initially deferred
);

create table public.workout_sets (
  id                  uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.workout_session_exercises(id) on delete cascade,
  set_number          smallint not null check (set_number > 0),
  weight_kg           numeric(6,2) check (weight_kg >= 0),
  reps                smallint check (reps > 0),
  duration_sec        int check (duration_sec > 0),
  distance_m          numeric(10,2) check (distance_m > 0),
  rpe                 numeric(3,1) check (rpe between 1 and 10),
  is_warmup           boolean not null default false,
  is_completed        boolean not null default false,
  completed_at        timestamptz,
  notes               text,
  unique (session_exercise_id, set_number)
);

create table public.personal_records (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  exercise_id        bigint references public.exercises(id) on delete cascade,
  activity_type_id   bigint references public.activity_types(id) on delete cascade,
  record_type        text not null check (record_type in
                       ('max_weight','max_reps','estimated_1rm','max_volume','fastest_time','longest_distance')),
  value              numeric not null check (value > 0),
  unit               text not null,
  achieved_on        date not null,
  workout_session_id uuid references public.workout_sessions(id) on delete set null,
  activity_log_id    uuid,                                   -- FK added below (activity_logs defined next)
  created_at         timestamptz not null default now(),
  -- A PR belongs to exactly one subject. History is kept (one row per new best) for progression charts.
  check (num_nonnulls(exercise_id, activity_type_id) = 1)
);

create table public.activity_logs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  activity_type_id     bigint not null references public.activity_types(id) on delete restrict,
  logged_on            date not null,
  started_at           timestamptz not null default now(),
  duration_minutes     numeric(7,2) not null check (duration_minutes > 0),
  distance_km          numeric(8,3) check (distance_km > 0),
  avg_pace_sec_per_km  int check (avg_pace_sec_per_km > 0),
  calories_burned      int check (calories_burned >= 0),
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.personal_records
  add constraint personal_records_activity_log_fk
  foreign key (activity_log_id) references public.activity_logs(id) on delete set null;
