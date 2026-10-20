-- 007_indexes.sql
-- Indexes for common access paths. Unique constraints already create indexes for
-- (user_id, date) lookups on weight/body/sleep/recovery/food_logs/streaks/notifications.

-- Master data search & filtering --------------------------------------------
create index food_items_name_trgm_idx   on public.food_items using gin (lower(name) extensions.gin_trgm_ops);
create index food_items_category_idx    on public.food_items (category_id);
create index food_items_barcode_idx     on public.food_items (barcode) where barcode is not null;
create index food_servings_food_idx     on public.food_servings (food_item_id);

create index exercises_name_trgm_idx    on public.exercises using gin (lower(name) extensions.gin_trgm_ops);
create index exercises_category_idx     on public.exercises (category_id);
create index exercises_muscle_idx       on public.exercises (primary_muscle);
create index exercises_equipment_idx    on public.exercises (equipment);
create index exercises_difficulty_idx   on public.exercises (difficulty);
create index exercises_movement_idx     on public.exercises (movement_type);

create index goal_templates_type_idx    on public.goal_templates (goal_type);
create index achievement_defs_metric_idx on public.achievement_definitions (metric) where is_active;

-- Nutrition --------------------------------------------------------------------
create index custom_foods_user_idx            on public.custom_foods (user_id, created_at desc);
create index custom_foods_name_trgm_idx       on public.custom_foods using gin (lower(name) extensions.gin_trgm_ops);
create index custom_food_ingredients_food_idx on public.custom_food_ingredients (custom_food_id, position);
create index custom_food_ingredients_item_idx on public.custom_food_ingredients (food_item_id);
create index recipes_user_idx                 on public.recipes (user_id, created_at desc);
create index recipe_ingredients_recipe_idx    on public.recipe_ingredients (recipe_id, position);
create index recipe_ingredients_item_idx      on public.recipe_ingredients (food_item_id) where food_item_id is not null;
create index recipe_ingredients_custom_idx    on public.recipe_ingredients (custom_food_id) where custom_food_id is not null;

create unique index favorite_foods_item_uidx   on public.favorite_foods (user_id, food_item_id)   where food_item_id is not null;
create unique index favorite_foods_custom_uidx on public.favorite_foods (user_id, custom_food_id) where custom_food_id is not null;
create unique index favorite_foods_recipe_uidx on public.favorite_foods (user_id, recipe_id)      where recipe_id is not null;

create index food_logs_user_date_idx    on public.food_logs (user_id, logged_on desc);
create index food_log_items_log_idx     on public.food_log_items (food_log_id);
create index food_log_items_food_idx    on public.food_log_items (food_item_id) where food_item_id is not null;  -- "most eaten foods"

-- Workouts & activity ----------------------------------------------------------
create index workout_plans_user_idx           on public.workout_plans (user_id) where not is_archived;
create index workout_plan_exercises_plan_idx  on public.workout_plan_exercises (plan_id, position);
create index workout_plan_exercises_ex_idx    on public.workout_plan_exercises (exercise_id);
create index workout_sessions_user_date_idx   on public.workout_sessions (user_id, logged_on desc);
create index workout_sessions_user_status_idx on public.workout_sessions (user_id, status);
create index workout_session_ex_session_idx   on public.workout_session_exercises (session_id, position);
create index workout_session_ex_exercise_idx  on public.workout_session_exercises (exercise_id);
create index personal_records_lookup_idx      on public.personal_records (user_id, exercise_id, record_type, achieved_on desc);
create index personal_records_activity_idx    on public.personal_records (user_id, activity_type_id, record_type, achieved_on desc)
  where activity_type_id is not null;
create index activity_logs_user_date_idx      on public.activity_logs (user_id, logged_on desc);
create index activity_logs_type_idx           on public.activity_logs (activity_type_id);

-- Lifestyle ----------------------------------------------------------------------
create index water_logs_user_date_idx   on public.water_logs (user_id, logged_on);
create index progress_photos_user_idx   on public.progress_photos (user_id, taken_on desc);

-- Goals, achievements, notifications -----------------------------------------------
create index goals_user_status_idx         on public.goals (user_id, status);
create index goal_progress_goal_idx        on public.goal_progress (goal_id, recorded_on desc);
create index user_achievements_user_idx    on public.user_achievements (user_id, unlocked_at desc);
create index notifications_unread_idx      on public.notifications (user_id, created_at desc) where read_at is null;

-- AI ----------------------------------------------------------------------------------
create index ai_conversations_user_idx   on public.ai_conversations (user_id, updated_at desc);
create index ai_messages_conv_idx        on public.ai_messages (conversation_id, created_at);
create index ai_insights_user_idx        on public.ai_insights (user_id, insight_date desc);
create index ai_food_scans_user_idx      on public.ai_food_scans (user_id, created_at desc);
create index ai_generated_workouts_idx   on public.ai_generated_workouts (user_id, created_at desc);
create index ai_usage_logs_user_idx      on public.ai_usage_logs (user_id, created_at desc);
