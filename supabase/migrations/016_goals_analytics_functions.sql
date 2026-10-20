-- 016_goals_analytics_functions.sql  (Phase 5)
-- Goals (auto-updating progress), achievement progress, calendar and analytics aggregates.
-- Heavy aggregation lives in Postgres so a page needs ONE round trip, not dozens.

alter table public.goals add column if not exists config jsonb not null default '{}'::jsonb;   -- e.g. {"distance_km": 5}
create unique index if not exists goal_progress_goal_day_uidx on public.goal_progress (goal_id, recorded_on);

-- 1. Achievement metrics, defined ONCE ------------------------------------------------------------------
-- Used by evaluate_achievements() (unlock) and achievement_progress() (show how far away each one is).

create or replace function private.user_metrics(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'workouts_completed',       (select count(*) from public.workout_sessions w where w.user_id = p_uid and w.status = 'completed'),
    'meals_logged',             (select count(*) from public.food_logs l where l.user_id = p_uid
                                   and exists (select 1 from public.food_log_items i where i.food_log_id = l.id)),
    'personal_records',         (select count(*) from public.personal_records p where p.user_id = p_uid),
    'longest_workout_streak',   coalesce((select longest_count from public.streaks s where s.user_id = p_uid and s.streak_type = 'workout'),   0),
    'longest_nutrition_streak', coalesce((select longest_count from public.streaks s where s.user_id = p_uid and s.streak_type = 'nutrition'), 0),
    'longest_hydration_streak', coalesce((select longest_count from public.streaks s where s.user_id = p_uid and s.streak_type = 'hydration'), 0),
    'sleep_logs',               (select count(*) from public.sleep_logs sl where sl.user_id = p_uid),
    'longest_run_km',           coalesce((select max(a.distance_km) from public.activity_logs a
                                   join public.activity_types t on t.id = a.activity_type_id
                                   where a.user_id = p_uid and t.slug = 'running'), 0)
  )
$$;

-- Same behaviour as 009, now driven by user_metrics, plus an in-app notification per unlock.
create or replace function public.evaluate_achievements()
returns setof public.achievement_definitions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  return query
  with m as (select private.user_metrics(v_uid) as j),
  eligible as (
    select d.id
    from public.achievement_definitions d, m
    where d.is_active
      and not exists (select 1 from public.user_achievements ua where ua.user_id = v_uid and ua.achievement_id = d.id)
      and coalesce((m.j ->> d.metric)::numeric, 0) >= d.threshold
  ),
  ins as (
    insert into public.user_achievements (user_id, achievement_id)
    select v_uid, e.id from eligible e
    on conflict (user_id, achievement_id) do nothing
    returning achievement_id
  ),
  note as (
    insert into public.notifications (user_id, type, title, body, data, dedupe_key)
    select v_uid, 'achievement', 'Achievement unlocked: ' || d.name, d.description,
           jsonb_build_object('achievement_id', d.id), 'ach:' || d.id
    from public.achievement_definitions d join ins on ins.achievement_id = d.id
    where exists (select 1 from public.notification_preferences np where np.user_id = v_uid and np.enabled)
    on conflict (user_id, dedupe_key) do nothing
    returning 1
  )
  select d.* from public.achievement_definitions d join ins on ins.achievement_id = d.id
  order by d.sort_order;
end;
$$;

-- Every achievement with the user's current value and unlock date (RLS applies to the joins).
create or replace function public.achievement_progress()
returns table (
  id            bigint,
  code          text,
  name          text,
  description   text,
  category      text,
  icon          text,
  metric        text,
  threshold     numeric,
  sort_order    int,
  current_value numeric,
  unlocked_at   timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select d.id, d.code, d.name, d.description, d.category, d.icon, d.metric, d.threshold, d.sort_order,
         coalesce((m.j ->> d.metric)::numeric, 0),
         ua.unlocked_at
  from public.achievement_definitions d
  cross join (select private.user_metrics((select auth.uid())) as j) m
  left join public.user_achievements ua on ua.achievement_id = d.id and ua.user_id = (select auth.uid())
  where d.is_active
  order by d.sort_order
$$;

-- 2. Goal values ---------------------------------------------------------------------------------------
-- Computes the CURRENT value of a goal's metric from the user's own data. NULL = not measurable
-- (manual goals, or no data yet). Rates use the last 7 days that have data, so one missed day does not
-- drag a protein or water average toward zero.

create or replace function private.goal_value(p_uid uuid, p_goal public.goals, p_today date, p_week_start int)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v numeric;
  d numeric;
begin
  case p_goal.metric
    when 'weight_kg' then
      select weight_kg into v from public.weight_logs where user_id = p_uid order by logged_on desc limit 1;
    when 'body_fat_pct' then
      select body_fat_pct into v from public.body_measurements where user_id = p_uid and body_fat_pct is not null order by measured_on desc limit 1;
    when 'waist_cm' then
      select waist_cm into v from public.body_measurements where user_id = p_uid and waist_cm is not null order by measured_on desc limit 1;
    when 'chest_cm' then
      select chest_cm into v from public.body_measurements where user_id = p_uid and chest_cm is not null order by measured_on desc limit 1;
    when 'arm_cm' then
      select arm_cm into v from public.body_measurements where user_id = p_uid and arm_cm is not null order by measured_on desc limit 1;
    when 'thigh_cm' then
      select thigh_cm into v from public.body_measurements where user_id = p_uid and thigh_cm is not null order by measured_on desc limit 1;
    when 'hip_cm' then
      select hip_cm into v from public.body_measurements where user_id = p_uid and hip_cm is not null order by measured_on desc limit 1;
    when 'one_rep_max_kg' then
      select max(value) into v from public.personal_records
       where user_id = p_uid and exercise_id = p_goal.exercise_id and record_type = 'estimated_1rm';
    when 'max_weight_kg' then
      select max(value) into v from public.personal_records
       where user_id = p_uid and exercise_id = p_goal.exercise_id and record_type = 'max_weight';
    when 'run_time_min' then
      -- Best time over the goal distance, extrapolated from the pace of runs at least that long.
      d := coalesce(nullif(p_goal.config ->> 'distance_km', '')::numeric, 5);
      select min(a.duration_minutes * d / a.distance_km) into v
        from public.activity_logs a join public.activity_types t on t.id = a.activity_type_id
       where a.user_id = p_uid and t.slug = 'running' and a.distance_km >= d;
    when 'monthly_run_km' then
      select coalesce(sum(a.distance_km), 0) into v
        from public.activity_logs a join public.activity_types t on t.id = a.activity_type_id
       where a.user_id = p_uid and t.slug = 'running'
         and a.logged_on >= date_trunc('month', p_today)::date and a.logged_on <= p_today;
    when 'daily_protein_g' then
      select avg(t) into v from (
        select sum(i.protein_g) t from public.food_logs l join public.food_log_items i on i.food_log_id = l.id
         where l.user_id = p_uid and l.logged_on between p_today - 6 and p_today group by l.logged_on) s;
    when 'daily_fiber_g' then
      select avg(t) into v from (
        select sum(i.fiber_g) t from public.food_logs l join public.food_log_items i on i.food_log_id = l.id
         where l.user_id = p_uid and l.logged_on between p_today - 6 and p_today group by l.logged_on) s;
    when 'daily_water_ml' then
      select avg(t) into v from (
        select sum(amount_ml) t from public.water_logs
         where user_id = p_uid and logged_on between p_today - 6 and p_today group by logged_on) s;
    when 'workouts_per_week' then
      select count(*) into v from public.workout_sessions
       where user_id = p_uid and status = 'completed'
         and logged_on >= p_today - ((extract(dow from p_today)::int - p_week_start + 7) % 7);
    when 'sleep_hours' then
      select avg(duration_minutes) / 60.0 into v from public.sleep_logs
       where user_id = p_uid and sleep_date between p_today - 6 and p_today;
    else
      v := null;   -- 'custom' and anything unknown: updated by the user
  end case;
  return round(v, 2);
end;
$$;

-- 3. sync_progress: refresh goals, the habit streak and achievements in one call ---------------------
-- SECURITY DEFINER because it writes server-managed tables (streaks, notifications); everything is
-- scoped to auth.uid(). p_today is limited to +-1 day of the server date (same window as update_streak).

create or replace function public.sync_progress(p_today date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_week_start int;
  g            public.goals;
  v            numeric;
  v_start      numeric;
  v_reached    boolean;
  v_updated    int := 0;
  v_done       jsonb := '[]'::jsonb;
  v_unlocked   jsonb;
  v_active     boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_today not between current_date - 1 and current_date + 1 then
    raise exception 'date out of range' using errcode = '22023';
  end if;

  select coalesce(week_starts_on, 1) into v_week_start from public.user_settings where user_id = v_uid;
  v_week_start := coalesce(v_week_start, 1);

  -- Habit streak = consecutive days with ANY tracked action (food, water, workout, activity, weight, sleep, check-in).
  select exists (select 1 from public.water_logs where user_id = v_uid and logged_on = p_today)
      or exists (select 1 from public.food_logs l where l.user_id = v_uid and l.logged_on = p_today
                   and exists (select 1 from public.food_log_items i where i.food_log_id = l.id))
      or exists (select 1 from public.workout_sessions where user_id = v_uid and status = 'completed' and logged_on = p_today)
      or exists (select 1 from public.activity_logs where user_id = v_uid and logged_on = p_today)
      or exists (select 1 from public.weight_logs where user_id = v_uid and logged_on = p_today)
      or exists (select 1 from public.sleep_logs where user_id = v_uid and sleep_date = p_today)
      or exists (select 1 from public.recovery_logs where user_id = v_uid and log_date = p_today)
    into v_active;
  if v_active then
    perform public.update_streak('habit', p_today);
  end if;

  for g in select * from public.goals where user_id = v_uid and status = 'active' loop
    v := private.goal_value(v_uid, g, p_today, v_week_start);
    continue when v is null;

    -- Rate-style metrics start from 0; measurement-style metrics start from where you were when you began.
    v_start := coalesce(g.start_value,
      case when g.metric in ('workouts_per_week','monthly_run_km','daily_protein_g','daily_fiber_g','daily_water_ml','sleep_hours')
           then 0 else v end);
    v_reached := case when g.direction = 'increase' then v >= g.target_value else v <= g.target_value end;

    update public.goals
       set current_value = v,
           start_value   = v_start,
           status        = case when v_reached then 'completed' else status end,
           completed_at  = case when v_reached then now() else completed_at end
     where id = g.id;

    insert into public.goal_progress (goal_id, user_id, recorded_on, value)
    values (g.id, v_uid, p_today, v)
    on conflict (goal_id, recorded_on) do update set value = excluded.value;

    v_updated := v_updated + 1;

    if v_reached then
      v_done := v_done || to_jsonb(g.title);
      insert into public.notifications (user_id, type, title, body, data, dedupe_key)
      select v_uid, 'goal_done', 'Goal reached: ' || g.title, 'You hit your target. Time to set the next one?',
             jsonb_build_object('goal_id', g.id), 'goal_done:' || g.id
      where exists (select 1 from public.notification_preferences np where np.user_id = v_uid and np.enabled)
      on conflict (user_id, dedupe_key) do nothing;
    end if;
  end loop;

  select coalesce(jsonb_agg(a.name), '[]'::jsonb) into v_unlocked from public.evaluate_achievements() a;

  return jsonb_build_object('goals_updated', v_updated, 'goals_completed', v_done, 'achievements', v_unlocked);
end;
$$;

-- 4. Calendar: one row per day that has ANY data -------------------------------------------------------

create or replace function public.calendar_days(p_from date, p_to date)
returns table (
  day            date,
  workouts       jsonb,
  activities     jsonb,
  kcal           numeric,
  water_ml       int,
  sleep_minutes  int,
  weight_kg      numeric,
  recovery_score numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with r as (select p_from as f, least(p_to, p_from + 62) as t, (select auth.uid()) as uid),
  w as (select s.logged_on d, jsonb_agg(s.name order by s.started_at) names
        from public.workout_sessions s, r
        where s.user_id = r.uid and s.status = 'completed' and s.logged_on between r.f and r.t group by 1),
  a as (select x.logged_on d, jsonb_agg(t.name order by x.started_at) names
        from public.activity_logs x join public.activity_types t on t.id = x.activity_type_id, r
        where x.user_id = r.uid and x.logged_on between r.f and r.t group by 1),
  f as (select l.logged_on d, sum(i.calories) kcal
        from public.food_logs l join public.food_log_items i on i.food_log_id = l.id, r
        where l.user_id = r.uid and l.logged_on between r.f and r.t group by 1),
  wa as (select x.logged_on d, sum(x.amount_ml)::int ml from public.water_logs x, r
         where x.user_id = r.uid and x.logged_on between r.f and r.t group by 1),
  sl as (select x.sleep_date d, x.duration_minutes mins from public.sleep_logs x, r
         where x.user_id = r.uid and x.sleep_date between r.f and r.t),
  wt as (select x.logged_on d, x.weight_kg kg from public.weight_logs x, r
         where x.user_id = r.uid and x.logged_on between r.f and r.t),
  rc as (select x.log_date d, x.recovery_score sc from public.recovery_logs x, r
         where x.user_id = r.uid and x.log_date between r.f and r.t)
  select dd::date as day, w.names, a.names, f.kcal, wa.ml, sl.mins, wt.kg, rc.sc
  from r
  cross join generate_series(r.f, r.t, interval '1 day') dd
  left join w  on w.d  = dd::date
  left join a  on a.d  = dd::date
  left join f  on f.d  = dd::date
  left join wa on wa.d = dd::date
  left join sl on sl.d = dd::date
  left join wt on wt.d = dd::date
  left join rc on rc.d = dd::date
  where w.d is not null or a.d is not null or f.d is not null or wa.d is not null
     or sl.d is not null or wt.d is not null or rc.d is not null
  order by 1
$$;

-- 5. Analytics aggregates -------------------------------------------------------------------------------

create or replace function public.analytics_workout(p_from date, p_to date, p_week_start int default 1)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with s as (
    select id, logged_on, total_volume_kg from public.workout_sessions
    where user_id = (select auth.uid()) and status = 'completed'
      and logged_on between greatest(p_from, p_to - 400) and p_to),
  weekly as (
    select (logged_on - ((extract(dow from logged_on)::int - p_week_start + 7) % 7)) as wk,
           count(*) as n, coalesce(sum(total_volume_kg), 0) as vol
    from s group by 1),
  sets as (
    select se.exercise_id, count(*) filter (where not w.is_warmup) as n
    from public.workout_session_exercises se
    join s on s.id = se.session_id
    join public.workout_sets w on w.session_exercise_id = se.id and w.is_completed
    group by se.exercise_id),
  muscles as (
    select coalesce(e.primary_muscle, 'other') as m, sum(sets.n) as n
    from sets join public.exercises e on e.id = sets.exercise_id group by 1),
  top as (
    select e.id, e.name, count(distinct se.session_id) as n
    from public.workout_session_exercises se
    join s on s.id = se.session_id
    join public.exercises e on e.id = se.exercise_id
    group by e.id, e.name order by n desc, e.name limit 8)
  select jsonb_build_object(
    'weekly',        coalesce((select jsonb_agg(jsonb_build_object('week', wk, 'workouts', n, 'volume_kg', vol) order by wk) from weekly), '[]'::jsonb),
    'muscles',       coalesce((select jsonb_agg(jsonb_build_object('muscle', m, 'sets', n) order by n desc, m) from muscles), '[]'::jsonb),
    'top_exercises', coalesce((select jsonb_agg(jsonb_build_object('exercise_id', id, 'name', name, 'sessions', n) order by n desc, name) from top), '[]'::jsonb))
$$;

create or replace function public.analytics_nutrition(p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with d as (
    select l.logged_on,
           sum(i.calories) kcal, sum(i.protein_g) p, sum(i.carbs_g) c, sum(i.fat_g) f, sum(i.fiber_g) fi
    from public.food_logs l join public.food_log_items i on i.food_log_id = l.id
    where l.user_id = (select auth.uid()) and l.logged_on between greatest(p_from, p_to - 400) and p_to
    group by l.logged_on),
  foods as (
    select min(i.name_snapshot) as name, count(*) as n, sum(i.calories) as kcal
    from public.food_logs l join public.food_log_items i on i.food_log_id = l.id
    where l.user_id = (select auth.uid()) and l.logged_on between greatest(p_from, p_to - 400) and p_to
    group by lower(i.name_snapshot) order by n desc, lower(min(i.name_snapshot)) limit 8)
  select jsonb_build_object(
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date', logged_on, 'calories', kcal, 'protein_g', p, 'carbs_g', c, 'fat_g', f, 'fiber_g', fi) order by logged_on) from d), '[]'::jsonb),
    'top_foods', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'count', n, 'calories', kcal) order by n desc, name) from foods), '[]'::jsonb))
$$;

-- 6. Privileges ---------------------------------------------------------------------------------------------
grant execute on function private.user_metrics(uuid)                       to authenticated, service_role;
grant execute on function private.goal_value(uuid, public.goals, date, int) to authenticated, service_role;

revoke execute on function public.achievement_progress()                      from public, anon;
revoke execute on function public.sync_progress(date)                         from public, anon;
revoke execute on function public.calendar_days(date, date)                   from public, anon;
revoke execute on function public.analytics_workout(date, date, int)          from public, anon;
revoke execute on function public.analytics_nutrition(date, date)             from public, anon;
revoke execute on function public.evaluate_achievements()                     from public, anon;

grant execute on function public.achievement_progress()                       to authenticated;
grant execute on function public.sync_progress(date)                          to authenticated;
grant execute on function public.calendar_days(date, date)                    to authenticated;
grant execute on function public.analytics_workout(date, date, int)           to authenticated;
grant execute on function public.analytics_nutrition(date, date)              to authenticated;
grant execute on function public.evaluate_achievements()                      to authenticated;
