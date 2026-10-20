-- 009_functions.sql
-- Business logic that must live in the database: onboarding bootstrap, search,
-- daily aggregates, streaks, achievements and personal records.

-- 1. New-user bootstrap -------------------------------------------------------------------------------
-- Creates profile + settings + preferences + notification prefs + streak rows automatically.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    )
  );
  insert into public.user_settings (user_id) values (new.id);
  insert into public.user_preferences (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  insert into public.streaks (user_id, streak_type)
    select new.id, t from unnest(array['workout','nutrition','hydration','habit']) as t;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant  execute on function public.handle_new_user() to supabase_auth_admin;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. updated_at triggers on every table that has the column -----------------------------------------------

do $$
declare t record;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t.table_name);
  end loop;
end $$;

-- 3. Food search (server/database driven; never ship the whole table to the browser) --------------------------
-- SECURITY INVOKER: RLS still applies. Ranking: exact > prefix > substring > fuzzy.

create or replace function public.search_foods(
  p_query       text,
  p_category_id bigint default null,
  p_limit       int    default 20,
  p_offset      int    default 0
)
returns setof public.food_items
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (
    select
      lower(trim(coalesce(p_query, '')))                                              as term,
      replace(replace(replace(lower(trim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') as pattern
  )
  select f.*
  from public.food_items f, q
  where (p_category_id is null or f.category_id = p_category_id)
    and (
      q.term = ''
      or lower(f.name) like '%' || q.pattern || '%'
      or lower(f.name) % q.term                     -- trigram similarity (typo tolerant)
    )
  order by
    case
      when q.term = ''                    then 3
      when lower(f.name) = q.term         then 0
      when lower(f.name) like q.pattern || '%' then 1
      when lower(f.name) like '%' || q.pattern || '%' then 2
      else 3
    end,
    similarity(lower(f.name), q.term) desc,
    f.name
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0)
$$;

-- 4. Daily aggregates (called by the dashboard service; SECURITY INVOKER => RLS applies) ---------------------

create or replace function public.daily_nutrition_totals(p_date date)
returns table (
  calories    numeric,
  protein_g   numeric,
  carbs_g     numeric,
  fat_g       numeric,
  fiber_g     numeric,
  items_count int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(i.calories),  0),
    coalesce(sum(i.protein_g), 0),
    coalesce(sum(i.carbs_g),   0),
    coalesce(sum(i.fat_g),     0),
    coalesce(sum(i.fiber_g),   0),
    count(i.id)::int
  from public.food_logs l
  join public.food_log_items i on i.food_log_id = l.id
  where l.user_id = (select auth.uid()) and l.logged_on = p_date
$$;

create or replace function public.daily_water_total(p_date date)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(amount_ml), 0)::int
  from public.water_logs
  where user_id = (select auth.uid()) and logged_on = p_date
$$;

-- 5. Streaks (incremental; O(1) per activity instead of re-scanning history) ---------------------------------
-- p_date must be within +-1 day of the server date so a client cannot fabricate long streaks.

create or replace function public.update_streak(p_type text, p_date date default null)
returns public.streaks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_date date := coalesce(p_date, current_date);
  v_row  public.streaks;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_date not between current_date - 1 and current_date + 1 then
    raise exception 'streak date out of range' using errcode = '22023';
  end if;

  insert into public.streaks (user_id, streak_type) values (v_uid, p_type)
  on conflict (user_id, streak_type) do nothing;

  select * into v_row from public.streaks where user_id = v_uid and streak_type = p_type for update;

  if v_row.last_activity_date = v_date
     or (v_row.last_activity_date is not null and v_date < v_row.last_activity_date) then
    return v_row;                                           -- same day or back-fill: nothing to change
  end if;

  update public.streaks s set
    current_count      = case when s.last_activity_date = v_date - 1 then s.current_count + 1 else 1 end,
    longest_count      = greatest(s.longest_count,
                                  case when s.last_activity_date = v_date - 1 then s.current_count + 1 else 1 end),
    last_activity_date = v_date,
    updated_at         = now()
  where s.id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

-- 6. Achievements (unlocked ONLY here; clients have no INSERT privilege) -----------------------------------------
-- Each definition is (metric, threshold). Returns the achievements unlocked by this call.

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
  with m as (
    select
      (select count(*) from public.workout_sessions w where w.user_id = v_uid and w.status = 'completed')::numeric
        as workouts_completed,
      (select count(*) from public.food_logs l
         where l.user_id = v_uid
           and exists (select 1 from public.food_log_items i where i.food_log_id = l.id))::numeric
        as meals_logged,
      (select count(*) from public.personal_records p where p.user_id = v_uid)::numeric
        as personal_records,
      coalesce((select longest_count from public.streaks s where s.user_id = v_uid and s.streak_type = 'workout'),   0)::numeric
        as longest_workout_streak,
      coalesce((select longest_count from public.streaks s where s.user_id = v_uid and s.streak_type = 'nutrition'), 0)::numeric
        as longest_nutrition_streak,
      coalesce((select longest_count from public.streaks s where s.user_id = v_uid and s.streak_type = 'hydration'), 0)::numeric
        as longest_hydration_streak,
      (select count(*) from public.sleep_logs sl where sl.user_id = v_uid)::numeric
        as sleep_logs,
      coalesce((select max(a.distance_km)
                from public.activity_logs a
                join public.activity_types t on t.id = a.activity_type_id
                where a.user_id = v_uid and t.slug = 'running'), 0)::numeric
        as longest_run_km
  ),
  eligible as (
    select d.id
    from public.achievement_definitions d, m
    where d.is_active
      and not exists (select 1 from public.user_achievements ua
                      where ua.user_id = v_uid and ua.achievement_id = d.id)
      and (case d.metric
             when 'workouts_completed'        then m.workouts_completed
             when 'meals_logged'              then m.meals_logged
             when 'personal_records'          then m.personal_records
             when 'longest_workout_streak'    then m.longest_workout_streak
             when 'longest_nutrition_streak'  then m.longest_nutrition_streak
             when 'longest_hydration_streak'  then m.longest_hydration_streak
             when 'sleep_logs'                then m.sleep_logs
             when 'longest_run_km'            then m.longest_run_km
             else 0
           end) >= d.threshold
  ),
  ins as (
    insert into public.user_achievements (user_id, achievement_id)
    select v_uid, e.id from eligible e
    on conflict (user_id, achievement_id) do nothing
    returning achievement_id
  )
  select d.* from public.achievement_definitions d join ins on ins.achievement_id = d.id
  order by d.sort_order;
end;
$$;

-- 7. Personal records from a completed workout ------------------------------------------------------------------
-- Inserts a NEW row whenever a value beats the previous best (history is kept for progression charts).
-- Warm-up and incomplete sets are ignored. Epley: 1RM = w * (1 + reps / 30); reps = 1 => w.

create or replace function public.record_workout_prs(p_session_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_date  date;
  v_count int  := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select s.logged_on into v_date
  from public.workout_sessions s
  where s.id = p_session_id and s.user_id = v_uid and s.status = 'completed';

  if not found then
    raise exception 'completed workout not found' using errcode = 'P0002';
  end if;

  with agg as (
    select
      se.exercise_id,
      max(s.weight_kg) filter (where s.weight_kg > 0 and s.reps > 0)                         as max_weight,
      max(s.reps)      filter (where s.reps > 0)                                              as max_reps,
      max(case when s.reps = 1 then s.weight_kg else s.weight_kg * (1 + s.reps / 30.0) end)
          filter (where s.weight_kg > 0 and s.reps > 0)                                       as est_1rm,
      max(s.weight_kg * s.reps) filter (where s.weight_kg > 0 and s.reps > 0)                 as max_volume
    from public.workout_session_exercises se
    join public.workout_sets s on s.session_exercise_id = se.id
    where se.session_id = p_session_id and s.is_completed and not s.is_warmup
    group by se.exercise_id
  ),
  cand as (
    select exercise_id, 'max_weight'    as record_type, max_weight::numeric         as value, 'kg'   as unit from agg
    union all select exercise_id, 'max_reps',      max_reps::numeric,               'reps' from agg
    union all select exercise_id, 'estimated_1rm', round(est_1rm::numeric, 2),      'kg'   from agg
    union all select exercise_id, 'max_volume',    max_volume::numeric,             'kg'   from agg
  ),
  new_rows as (
    insert into public.personal_records
      (user_id, exercise_id, record_type, value, unit, achieved_on, workout_session_id)
    select v_uid, c.exercise_id, c.record_type, c.value, c.unit, v_date, p_session_id
    from cand c
    where c.value is not null and c.value > 0
      and c.value > coalesce((
        select max(pr.value) from public.personal_records pr
        where pr.user_id = v_uid and pr.exercise_id = c.exercise_id and pr.record_type = c.record_type
      ), 0)
    returning 1
  )
  select count(*) into v_count from new_rows;

  return v_count;
end;
$$;

-- 8. Function privileges: signed-in users only, never anon ------------------------------------------------------

revoke execute on function public.search_foods(text, bigint, int, int)  from public, anon;
revoke execute on function public.daily_nutrition_totals(date)           from public, anon;
revoke execute on function public.daily_water_total(date)                from public, anon;
revoke execute on function public.update_streak(text, date)              from public, anon;
revoke execute on function public.evaluate_achievements()                from public, anon;
revoke execute on function public.record_workout_prs(uuid)               from public, anon;

grant execute on function public.search_foods(text, bigint, int, int)  to authenticated;
grant execute on function public.daily_nutrition_totals(date)           to authenticated;
grant execute on function public.daily_water_total(date)                to authenticated;
grant execute on function public.update_streak(text, date)              to authenticated;
grant execute on function public.evaluate_achievements()                to authenticated;
grant execute on function public.record_workout_prs(uuid)               to authenticated;
