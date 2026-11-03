-- 022_custom_notification_schedules.sql: Add manual time schedules and thresholds for reminders
alter table public.notification_preferences
  add column if not exists workout_time time not null default '07:00',
  add column if not exists nutrition_time time not null default '17:00',
  add column if not exists hydration_time time not null default '14:00',
  add column if not exists min_sleep_hours numeric(3,1) not null default 6.0,
  add column if not exists min_streak_days smallint not null default 3;

