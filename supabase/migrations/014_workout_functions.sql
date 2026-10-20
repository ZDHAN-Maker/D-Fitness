-- 014_workout_functions.sql  (Phase 3)
-- Exercise search, atomic plan save, workout start/complete, previous performance,
-- personal-record views and activity PRs.
-- Everything is SECURITY INVOKER (RLS applies) unless a function must write server-managed
-- tables (personal_records / streaks / achievements), in which case it is SECURITY DEFINER and
-- scoped to auth.uid().

-- 1. Exercise library --------------------------------------------------------------------------------

create or replace function public.search_exercises(
  p_query       text   default '',
  p_category_id bigint default null,
  p_muscle      text   default null,
  p_equipment   text   default null,
  p_difficulty  text   default null,
  p_movement    text   default null,
  p_limit       int    default 24,
  p_offset      int    default 0
)
returns setof public.exercises
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (
    select
      lower(trim(coalesce(p_query, ''))) as term,
      replace(replace(replace(lower(trim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') as pattern
  )
  select e.*
  from public.exercises e, q
  where (p_category_id is null or e.category_id = p_category_id)
    and (p_muscle     is null or e.primary_muscle = p_muscle)
    and (p_equipment  is null or e.equipment = p_equipment)
    and (p_difficulty is null or e.difficulty = p_difficulty)
    and (p_movement   is null or e.movement_type = p_movement)
    and (q.term = '' or lower(e.name) like '%' || q.pattern || '%' or lower(e.name) % q.term)
  order by
    case when q.term = '' then 3
         when lower(e.name) = q.term then 0
         when lower(e.name) like q.pattern || '%' then 1
         when lower(e.name) like '%' || q.pattern || '%' then 2
         else 3 end,
    similarity(lower(e.name), q.term) desc,
    e.name
  limit least(greatest(p_limit, 1), 60)
  offset greatest(p_offset, 0)
$$;

-- Distinct filter values for the library UI (one tiny query instead of scanning all rows in the app).
create or replace function public.exercise_facets()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'muscles',     (select coalesce(jsonb_agg(v order by v), '[]') from (select distinct primary_muscle v from public.exercises where primary_muscle is not null) s),
    'equipment',   (select coalesce(jsonb_agg(v order by v), '[]') from (select distinct equipment v from public.exercises where equipment is not null) s),
    'difficulties',(select coalesce(jsonb_agg(v order by v), '[]') from (select distinct difficulty v from public.exercises where difficulty is not null) s),
    'movements',   (select coalesce(jsonb_agg(v order by v), '[]') from (select distinct movement_type v from public.exercises where movement_type is not null) s)
  )
$$;

-- 2. Workout plans (atomic: plan row + ordered exercises) ---------------------------------------------------

create or replace function public.save_workout_plan(p_id uuid, p_plan jsonb, p_exercises jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_id   uuid;
  v_days smallint[] := coalesce(
    array(select (jsonb_array_elements_text(coalesce(p_plan -> 'scheduled_days', '[]'::jsonb)))::smallint), '{}');
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_id is null then
    insert into public.workout_plans (user_id, name, description, scheduled_days)
    values (v_uid, p_plan ->> 'name', nullif(p_plan ->> 'description', ''), v_days)
    returning id into v_id;
  else
    update public.workout_plans
       set name = p_plan ->> 'name', description = nullif(p_plan ->> 'description', ''), scheduled_days = v_days
     where id = p_id and user_id = v_uid
    returning id into v_id;
    if v_id is null then
      raise exception 'workout plan not found' using errcode = 'P0002';
    end if;
    delete from public.workout_plan_exercises where plan_id = v_id;
  end if;

  insert into public.workout_plan_exercises
    (plan_id, exercise_id, position, target_sets, target_reps_min, target_reps_max, target_duration_sec, target_weight_kg, rest_seconds, notes)
  select v_id,
         (e ->> 'exercise_id')::bigint,
         (ord - 1)::int,                                   -- position = order in the array (drag/reorder result)
         coalesce((e ->> 'target_sets')::smallint, 3),
         nullif(e ->> 'target_reps_min', '')::smallint,
         nullif(e ->> 'target_reps_max', '')::smallint,
         nullif(e ->> 'target_duration_sec', '')::int,
         nullif(e ->> 'target_weight_kg', '')::numeric,
         nullif(e ->> 'rest_seconds', '')::int,
         nullif(e ->> 'notes', '')
  from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) with ordinality as t(e, ord);

  return v_id;
end;
$$;

-- 3. Start a workout (optionally from a plan) ---------------------------------------------------------------
-- Copies the plan's exercises in order and pre-creates empty sets (target_sets each) so the
-- active-workout screen only has to tick them off. One active workout per user (partial unique index).

create or replace function public.start_workout(p_plan_id uuid, p_name text, p_date date)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_id   uuid;
  v_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_date not between current_date - 1 and current_date + 1 then
    raise exception 'workout date out of range' using errcode = '22023';
  end if;

  if p_plan_id is not null then
    select name into v_name from public.workout_plans where id = p_plan_id and user_id = v_uid;
    if not found then
      raise exception 'workout plan not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.workout_sessions (user_id, plan_id, name, logged_on, status)
  values (v_uid, p_plan_id, coalesce(nullif(trim(p_name), ''), v_name, 'Workout'), p_date, 'in_progress')
  returning id into v_id;

  if p_plan_id is not null then
    insert into public.workout_session_exercises (session_id, exercise_id, position)
    select v_id, pe.exercise_id, pe.position from public.workout_plan_exercises pe where pe.plan_id = p_plan_id;

    insert into public.workout_sets (session_exercise_id, set_number)
    select se.id, gs
    from public.workout_session_exercises se
    join public.workout_plan_exercises pe on pe.plan_id = p_plan_id and pe.position = se.position
    cross join lateral generate_series(1, pe.target_sets) gs
    where se.session_id = v_id;
  end if;

  return v_id;
end;
$$;

-- 4. Complete a workout -----------------------------------------------------------------------------------------
-- Drops unfinished sets, caches total volume, then (server-managed) records PRs, bumps the workout
-- streak and evaluates achievements, all in one transaction.

create or replace function public.complete_workout(p_session_id uuid, p_effort numeric default null, p_notes text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_date     date;
  v_volume   numeric;
  v_prs      int;
  v_unlocked jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select logged_on into v_date from public.workout_sessions
   where id = p_session_id and user_id = v_uid and status = 'in_progress';
  if not found then
    raise exception 'active workout not found' using errcode = 'P0002';
  end if;

  delete from public.workout_sets w
   using public.workout_session_exercises se
   where w.session_exercise_id = se.id and se.session_id = p_session_id and not w.is_completed;

  delete from public.workout_session_exercises se
   where se.session_id = p_session_id
     and not exists (select 1 from public.workout_sets w where w.session_exercise_id = se.id);

  if not exists (select 1 from public.workout_session_exercises where session_id = p_session_id) then
    raise exception 'no completed sets' using errcode = 'P0001';   -- rolls back the deletes above
  end if;

  select coalesce(sum(w.weight_kg * w.reps) filter (where w.weight_kg > 0 and w.reps > 0 and not w.is_warmup), 0)
    into v_volume
    from public.workout_sets w
    join public.workout_session_exercises se on se.id = w.session_exercise_id
   where se.session_id = p_session_id and w.is_completed;

  update public.workout_sessions
     set status = 'completed', ended_at = now(), total_volume_kg = v_volume,
         perceived_effort = p_effort, notes = nullif(trim(coalesce(p_notes, '')), '')
   where id = p_session_id;

  v_prs := public.record_workout_prs(p_session_id);

  begin
    perform public.update_streak('workout', v_date);
  exception when others then
    null;   -- a back-dated workout outside the streak window must not block completion
  end;

  select coalesce(jsonb_agg(a.name), '[]'::jsonb) into v_unlocked from public.evaluate_achievements() a;

  return jsonb_build_object('total_volume_kg', v_volume, 'new_prs', v_prs, 'achievements', v_unlocked);
end;
$$;

-- 5. Previous performance (last completed session per exercise) ---------------------------------------------------

create or replace function public.previous_performance(p_exercise_ids bigint[], p_exclude_session uuid default null)
returns table (
  exercise_id  bigint,
  session_date date,
  set_number   smallint,
  weight_kg    numeric,
  reps         smallint,
  duration_sec int,
  distance_m   numeric,
  is_warmup    boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with last as (
    select distinct on (se.exercise_id) se.exercise_id, se.id as se_id, s.logged_on
    from public.workout_session_exercises se
    join public.workout_sessions s on s.id = se.session_id
    where se.exercise_id = any (p_exercise_ids)
      and s.user_id = (select auth.uid())
      and s.status = 'completed'
      and (p_exclude_session is null or s.id <> p_exclude_session)
      and exists (select 1 from public.workout_sets w where w.session_exercise_id = se.id and w.is_completed)
    order by se.exercise_id, s.logged_on desc, s.started_at desc
  )
  select l.exercise_id, l.logged_on, w.set_number, w.weight_kg, w.reps, w.duration_sec, w.distance_m, w.is_warmup
  from last l
  join public.workout_sets w on w.session_exercise_id = l.se_id and w.is_completed
  order by l.exercise_id, w.set_number
$$;

-- 6. Personal records: the CURRENT best per subject and type -------------------------------------------------------

create or replace function public.current_personal_records()
returns table (
  exercise_id      bigint,
  activity_type_id bigint,
  record_type      text,
  value            numeric,
  unit             text,
  achieved_on      date
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (coalesce(p.exercise_id::text, 'a' || p.activity_type_id::text), p.record_type)
         p.exercise_id, p.activity_type_id, p.record_type, p.value, p.unit, p.achieved_on
  from public.personal_records p
  where p.user_id = (select auth.uid())
  order by coalesce(p.exercise_id::text, 'a' || p.activity_type_id::text), p.record_type,
           case when p.record_type = 'fastest_time' then p.value else -p.value end asc,
           p.achieved_on desc
$$;

-- 7. Activity PRs: longest distance, and fastest pace over >= 1 km (lower s/km is better) ----------------------------

create or replace function public.record_activity_prs(p_activity_log_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_log   public.activity_logs;
  v_pace  numeric;
  v_count int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_log from public.activity_logs where id = p_activity_log_id and user_id = v_uid;
  if not found then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;

  if v_log.distance_km is not null and v_log.distance_km > coalesce((
       select max(value) from public.personal_records
       where user_id = v_uid and activity_type_id = v_log.activity_type_id and record_type = 'longest_distance'), 0) then
    insert into public.personal_records (user_id, activity_type_id, record_type, value, unit, achieved_on, activity_log_id)
    values (v_uid, v_log.activity_type_id, 'longest_distance', v_log.distance_km, 'km', v_log.logged_on, v_log.id);
    v_count := v_count + 1;
  end if;

  if v_log.distance_km is not null and v_log.distance_km >= 1 then
    v_pace := round(v_log.duration_minutes * 60 / v_log.distance_km);
    if v_pace > 0 and v_pace < coalesce((
         select min(value) from public.personal_records
         where user_id = v_uid and activity_type_id = v_log.activity_type_id and record_type = 'fastest_time'), 'Infinity'::numeric) then
      insert into public.personal_records (user_id, activity_type_id, record_type, value, unit, achieved_on, activity_log_id)
      values (v_uid, v_log.activity_type_id, 'fastest_time', v_pace, 's/km', v_log.logged_on, v_log.id);
      v_count := v_count + 1;
    end if;
  end if;

  return v_count;
end;
$$;

-- 8. Privileges ------------------------------------------------------------------------------------------------------
revoke execute on function public.search_exercises(text, bigint, text, text, text, text, int, int) from public, anon;
revoke execute on function public.exercise_facets()                       from public, anon;
revoke execute on function public.save_workout_plan(uuid, jsonb, jsonb)    from public, anon;
revoke execute on function public.start_workout(uuid, text, date)          from public, anon;
revoke execute on function public.complete_workout(uuid, numeric, text)    from public, anon;
revoke execute on function public.previous_performance(bigint[], uuid)     from public, anon;
revoke execute on function public.current_personal_records()               from public, anon;
revoke execute on function public.record_activity_prs(uuid)                from public, anon;

grant execute on function public.search_exercises(text, bigint, text, text, text, text, int, int) to authenticated;
grant execute on function public.exercise_facets()                       to authenticated;
grant execute on function public.save_workout_plan(uuid, jsonb, jsonb)    to authenticated;
grant execute on function public.start_workout(uuid, text, date)          to authenticated;
grant execute on function public.complete_workout(uuid, numeric, text)    to authenticated;
grant execute on function public.previous_performance(bigint[], uuid)     to authenticated;
grant execute on function public.current_personal_records()               to authenticated;
grant execute on function public.record_activity_prs(uuid)                to authenticated;

-- 9. Per-exercise history (exercise detail page) ------------------------------------------------------------------------
create or replace function public.exercise_history(p_exercise_id bigint, p_limit int default 8)
returns table (session_id uuid, session_date date, sets jsonb)
language sql
stable
security invoker
set search_path = public
as $$
  select s.id, s.logged_on,
         jsonb_agg(jsonb_build_object(
           'weight_kg', w.weight_kg, 'reps', w.reps, 'duration_sec', w.duration_sec,
           'distance_m', w.distance_m, 'is_warmup', w.is_warmup) order by w.set_number)
  from public.workout_session_exercises se
  join public.workout_sessions s on s.id = se.session_id
  join public.workout_sets w on w.session_exercise_id = se.id and w.is_completed
  where se.exercise_id = p_exercise_id and s.user_id = (select auth.uid()) and s.status = 'completed'
  group by s.id, s.logged_on, s.started_at
  order by s.logged_on desc, s.started_at desc
  limit least(greatest(p_limit, 1), 30)
$$;
revoke execute on function public.exercise_history(bigint, int) from public, anon;
grant  execute on function public.exercise_history(bigint, int) to authenticated;
