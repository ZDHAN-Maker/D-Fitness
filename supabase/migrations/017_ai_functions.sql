-- 017_ai_functions.sql  (Phase 6)
-- The model never sees the whole database: it is given a SMALL, diverse candidate list chosen here,
-- and its answer may only reference ids from that list (validated again in the application).

-- One daily insight per user and kind (regenerating replaces it).
create unique index if not exists ai_insights_user_day_kind_uidx on public.ai_insights (user_id, insight_date, kind);

-- Foods the meal assistant may recommend: up to p_per_category per category, ranked by protein per calorie,
-- excluding anything whose name matches the user's "disliked foods". SECURITY INVOKER (RLS applies).
create or replace function public.meal_candidates(p_per_category int default 5, p_limit int default 80)
returns setof public.food_items
language sql
stable
security invoker
set search_path = public
as $$
  with prefs as (
    select coalesce(disliked_foods, '{}') as d from public.user_preferences where user_id = (select auth.uid())
  ),
  ranked as (
    select f.id, coalesce(f.category_id, 0) as cat,
           row_number() over (
             partition by coalesce(f.category_id, 0)
             order by (f.protein_g / nullif(f.calories, 0)) desc nulls last, f.name
           ) as rn
    from public.food_items f
    where f.calories > 0
      and not exists (
        select 1 from prefs p, unnest(p.d) x
        where btrim(x) <> '' and lower(f.name) like '%' || lower(btrim(x)) || '%')
  )
  select f.*
  from public.food_items f
  join ranked r on r.id = f.id
  where r.rn <= least(greatest(p_per_category, 1), 20)
  order by r.cat, r.rn
  limit least(greatest(p_limit, 1), 150)
$$;

-- Exercises the workout generator may use: only equipment the user has (bodyweight is always allowed),
-- a few per muscle group so the plan can be balanced; beginners never get "advanced" movements.
create or replace function public.exercise_candidates(
  p_equipment  text[] default null,
  p_experience text   default null,
  p_per_muscle int    default 6,
  p_limit      int    default 80
)
returns setof public.exercises
language sql
stable
security invoker
set search_path = public
as $$
  with ranked as (
    select e.id, coalesce(e.primary_muscle, 'other') as m,
           row_number() over (partition by coalesce(e.primary_muscle, 'other') order by md5(e.id::text)) as rn
    from public.exercises e
    where (p_equipment is null or cardinality(p_equipment) = 0
           or e.equipment is null
           or lower(e.equipment) = 'bodyweight'
           or lower(e.equipment) = any (select lower(x) from unnest(p_equipment) x))
      and not (p_experience = 'beginner' and e.difficulty = 'advanced')
  )
  select e.*
  from public.exercises e
  join ranked r on r.id = e.id
  where r.rn <= least(greatest(p_per_muscle, 1), 20)
  order by r.m, r.rn
  limit least(greatest(p_limit, 1), 150)
$$;

revoke execute on function public.meal_candidates(int, int)                  from public, anon;
revoke execute on function public.exercise_candidates(text[], text, int, int) from public, anon;
grant  execute on function public.meal_candidates(int, int)                  to authenticated;
grant  execute on function public.exercise_candidates(text[], text, int, int) to authenticated;
