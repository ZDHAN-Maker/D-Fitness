-- 008_rls.sql
-- Row Level Security for EVERY table in public. RLS is never disabled.
--
--   master data      -> SELECT for authenticated; no write policy => writes denied for clients
--   user_id tables   -> SELECT/INSERT/UPDATE/DELETE only where user_id = auth.uid()
--   child tables     -> ownership resolved through the parent via private.owns_*() helpers
--   server-managed   -> SELECT only (streaks, user_achievements, personal_records, ai_usage_logs);
--                       writes happen through SECURITY DEFINER functions (009) or the service role
--
-- `(select auth.uid())` is wrapped in a sub-select so Postgres evaluates it once per
-- statement instead of once per row.

-- Ownership helpers (SECURITY DEFINER so they can read parents without recursing into RLS) ---------

create or replace function private.owns_food_log(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.food_logs where id = p_id and user_id = (select auth.uid())) $$;

create or replace function private.owns_custom_food(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.custom_foods where id = p_id and user_id = (select auth.uid())) $$;

create or replace function private.owns_recipe(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.recipes where id = p_id and user_id = (select auth.uid())) $$;

create or replace function private.owns_workout_plan(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.workout_plans where id = p_id and user_id = (select auth.uid())) $$;

create or replace function private.owns_workout_session(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.workout_sessions where id = p_id and user_id = (select auth.uid())) $$;

create or replace function private.owns_session_exercise(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (
     select 1
     from public.workout_session_exercises se
     join public.workout_sessions s on s.id = se.session_id
     where se.id = p_id and s.user_id = (select auth.uid())) $$;

create or replace function private.owns_goal(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.goals where id = p_id and user_id = (select auth.uid())) $$;

create or replace function private.owns_ai_conversation(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.ai_conversations where id = p_id and user_id = (select auth.uid())) $$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;

-- Enable RLS on every table ----------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'units','food_categories','food_items','food_servings','exercise_categories','exercises',
    'activity_types','goal_templates','achievement_definitions',
    'profiles','user_settings','user_preferences','notification_preferences','streaks','notifications',
    'weight_logs','body_measurements','progress_photos','sleep_logs','recovery_logs','water_logs',
    'goals','goal_progress','user_achievements',
    'workout_plans','workout_plan_exercises','workout_sessions','workout_session_exercises','workout_sets',
    'personal_records','activity_logs',
    'custom_foods','custom_food_ingredients','recipes','recipe_ingredients','favorite_foods','food_logs','food_log_items',
    'ai_conversations','ai_messages','ai_insights','ai_food_scans','ai_generated_workouts','ai_weekly_reviews','ai_usage_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Master data: read-only for signed-in users ------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'units','food_categories','food_items','food_servings','exercise_categories','exercises',
    'activity_types','goal_templates','achievement_definitions'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select_all', t);
  end loop;
end $$;

-- profiles (keyed by id, not user_id) --------------------------------------------------------------

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- No delete policy: profile is removed with the auth user (ON DELETE CASCADE).

-- Standard "my rows only" tables (full CRUD) -------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'user_settings','user_preferences','notification_preferences',
    'weight_logs','body_measurements','progress_photos','sleep_logs','recovery_logs','water_logs',
    'goals','activity_logs','custom_foods','recipes','food_logs',
    'ai_conversations','ai_insights','ai_food_scans','ai_generated_workouts','ai_weekly_reviews'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t||'_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t||'_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t||'_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t||'_delete_own', t);
  end loop;
end $$;

-- notifications: users read / mark read / dismiss; creation is server-side only ------------------------

create policy notifications_select_own on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
create policy notifications_update_own on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy notifications_delete_own on public.notifications for delete to authenticated using ((select auth.uid()) = user_id);

-- Server-managed, read-only for clients ----------------------------------------------------------------

create policy streaks_select_own           on public.streaks           for select to authenticated using ((select auth.uid()) = user_id);
create policy user_achievements_select_own on public.user_achievements for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_records_select_own  on public.personal_records  for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_usage_logs_select_own     on public.ai_usage_logs     for select to authenticated using ((select auth.uid()) = user_id);

-- Tables with cross-references: the referenced parent must ALSO belong to the caller -------------------

create policy favorite_foods_select_own on public.favorite_foods for select to authenticated using ((select auth.uid()) = user_id);
create policy favorite_foods_insert_own on public.favorite_foods for insert to authenticated
  with check ((select auth.uid()) = user_id
    and (custom_food_id is null or private.owns_custom_food(custom_food_id))
    and (recipe_id is null or private.owns_recipe(recipe_id)));
create policy favorite_foods_delete_own on public.favorite_foods for delete to authenticated using ((select auth.uid()) = user_id);

create policy workout_sessions_select_own on public.workout_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_sessions_insert_own on public.workout_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id and (plan_id is null or private.owns_workout_plan(plan_id)));
create policy workout_sessions_update_own on public.workout_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (plan_id is null or private.owns_workout_plan(plan_id)));
create policy workout_sessions_delete_own on public.workout_sessions for delete to authenticated using ((select auth.uid()) = user_id);

create policy workout_plans_select_own on public.workout_plans for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_plans_insert_own on public.workout_plans for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workout_plans_update_own on public.workout_plans for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy workout_plans_delete_own on public.workout_plans for delete to authenticated using ((select auth.uid()) = user_id);

create policy goal_progress_select_own on public.goal_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy goal_progress_insert_own on public.goal_progress for insert to authenticated
  with check ((select auth.uid()) = user_id and private.owns_goal(goal_id));
create policy goal_progress_update_own on public.goal_progress for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and private.owns_goal(goal_id));
create policy goal_progress_delete_own on public.goal_progress for delete to authenticated using ((select auth.uid()) = user_id);

-- Child tables (no user_id): ownership through the parent --------------------------------------------------

create policy food_log_items_all_own on public.food_log_items for all to authenticated
  using (private.owns_food_log(food_log_id))
  with check (private.owns_food_log(food_log_id)
    and (custom_food_id is null or private.owns_custom_food(custom_food_id))
    and (recipe_id is null or private.owns_recipe(recipe_id)));

create policy custom_food_ingredients_all_own on public.custom_food_ingredients for all to authenticated
  using (private.owns_custom_food(custom_food_id)) with check (private.owns_custom_food(custom_food_id));

create policy recipe_ingredients_all_own on public.recipe_ingredients for all to authenticated
  using (private.owns_recipe(recipe_id))
  with check (private.owns_recipe(recipe_id) and (custom_food_id is null or private.owns_custom_food(custom_food_id)));

create policy workout_plan_exercises_all_own on public.workout_plan_exercises for all to authenticated
  using (private.owns_workout_plan(plan_id)) with check (private.owns_workout_plan(plan_id));

create policy workout_session_exercises_all_own on public.workout_session_exercises for all to authenticated
  using (private.owns_workout_session(session_id)) with check (private.owns_workout_session(session_id));

create policy workout_sets_all_own on public.workout_sets for all to authenticated
  using (private.owns_session_exercise(session_exercise_id)) with check (private.owns_session_exercise(session_exercise_id));

create policy ai_messages_all_own on public.ai_messages for all to authenticated
  using (private.owns_ai_conversation(conversation_id)) with check (private.owns_ai_conversation(conversation_id));

-- Table privileges: the Data API roles never get more than the policies allow, and anon gets nothing. ----

revoke all on all tables in schema public from anon;

-- Defence in depth: remove privileges that no policy should ever grant.
revoke insert, update, delete, truncate on
  public.units, public.food_categories, public.food_items, public.food_servings,
  public.exercise_categories, public.exercises, public.activity_types,
  public.goal_templates, public.achievement_definitions
  from authenticated;

revoke insert, update, delete, truncate on
  public.streaks, public.user_achievements, public.personal_records, public.ai_usage_logs
  from authenticated;

revoke insert, truncate on public.notifications from authenticated;
