/**
 * Hand-written domain types that mirror the Postgres schema (supabase/migrations).
 * After applying migrations you can generate exact table types with `npm run db:types`
 * (writes src/types/database.types.ts) and migrate these gradually.
 * Dates are ISO strings: `date` columns are YYYY-MM-DD, timestamps are ISO 8601.
 */

export type ISODate = string;
export type ISOTimestamp = string;
export type UUID = string;

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "other";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type TrackingMode = "weight_reps" | "reps_only" | "duration" | "distance_duration" | "weight_duration";
export type GoalType = "body" | "strength" | "running" | "nutrition" | "habit";
export type GoalStatus = "active" | "completed" | "paused" | "abandoned";

export type MacroNutrients = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
};

// ── Identity & settings ────────────────────────────────────────────────────
export type Profile = {
  id: UUID;
  display_name: string | null;
  avatar_path: string | null;
  birth_date: ISODate | null;
  sex: "male" | "female" | null;
  height_cm: number | null;
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active" | null;
  experience_level: Difficulty | null;
  primary_goal: "lose_fat" | "build_muscle" | "maintain" | "improve_endurance" | "general_health" | null;
  timezone: string;
  unit_system: "metric" | "imperial";
  onboarding_completed: boolean;
};

export type UserSettings = {
  user_id: UUID;
  theme: "light" | "dark" | "system";
  week_starts_on: number;
  calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  fiber_target_g: number;
  water_target_ml: number;
  sleep_target_minutes: number;
  weekly_workout_target: number;
};

// ── Nutrition ──────────────────────────────────────────────────────────────
/** Nutrition is expressed per `base_quantity` of `base_unit` (default 100 g). */
export type Food = MacroNutrients & {
  id: number;
  source_id: string | null;
  category_id: number | null;
  name: string;
  brand: string | null;
  base_quantity: number;
  base_unit: "g" | "ml";
  sugar_g: number | null;
  sodium_mg: number | null;
  is_verified: boolean;
};

export type FoodServing = {
  id: number;
  food_item_id: number;
  label: string;
  unit_code: string;
  quantity: number;
  /** grams (or ml) equivalent of `quantity` × `unit_code` */
  base_amount: number;
  is_default: boolean;
};

export type CustomFood = MacroNutrients & {
  id: UUID;
  user_id: UUID;
  name: string;
  brand: string | null;
  description: string | null;
  base_quantity: number;
  base_unit: "g" | "ml";
  is_composite: boolean;
  ingredients?: Ingredient[];
};

export type Ingredient = {
  id: UUID;
  food_item_id: number | null;
  custom_food_id: UUID | null;
  position: number;
  quantity: number;
  unit_code: string;
  base_amount: number;
};

export type Recipe = {
  id: UUID;
  user_id: UUID;
  name: string;
  description: string | null;
  instructions: string | null;
  servings: number;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  ingredients?: Ingredient[];
};

export type FoodLogItem = MacroNutrients & {
  id: UUID;
  food_log_id: UUID;
  source: "database" | "custom" | "recipe" | "ai_scan" | "manual";
  food_item_id: number | null;
  custom_food_id: UUID | null;
  recipe_id: UUID | null;
  name_snapshot: string;
  quantity: number;
  unit_code: string;
  base_amount: number;
};

export type FoodLog = {
  id: UUID;
  user_id: UUID;
  logged_on: ISODate;
  meal_type: MealType;
  notes: string | null;
  items?: FoodLogItem[];
};

// ── Training ───────────────────────────────────────────────────────────────
export type Exercise = {
  id: number;
  source_id: string | null;
  category_id: number | null;
  name: string;
  primary_muscle: string | null;
  secondary_muscles: string[];
  equipment: string | null;
  difficulty: Difficulty | null;
  movement_type: string | null;
  tracking_mode: TrackingMode;
  instructions: string | null;
  image_url: string | null;
  video_url: string | null;
};

export type WorkoutPlanExercise = {
  id: UUID;
  plan_id: UUID;
  exercise_id: number;
  position: number;
  target_sets: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_duration_sec: number | null;
  target_weight_kg: number | null;
  rest_seconds: number | null;
  notes: string | null;
};

export type WorkoutPlan = {
  id: UUID;
  user_id: UUID;
  name: string;
  description: string | null;
  scheduled_days: number[];
  is_archived: boolean;
  exercises?: WorkoutPlanExercise[];
};

export type WorkoutSet = {
  id: UUID;
  session_exercise_id: UUID;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  duration_sec: number | null;
  distance_m: number | null;
  rpe: number | null;
  is_warmup: boolean;
  is_completed: boolean;
  notes: string | null;
};

export type WorkoutSession = {
  id: UUID;
  user_id: UUID;
  plan_id: UUID | null;
  name: string;
  status: "in_progress" | "completed" | "cancelled";
  logged_on: ISODate;
  started_at: ISOTimestamp;
  ended_at: ISOTimestamp | null;
  total_volume_kg: number | null;
  perceived_effort: number | null;
  exercises?: { id: UUID; exercise_id: number; position: number; sets: WorkoutSet[] }[];
};

export type Activity = {
  id: UUID;
  user_id: UUID;
  activity_type_id: number;
  logged_on: ISODate;
  duration_minutes: number;
  distance_km: number | null;
  avg_pace_sec_per_km: number | null;
  calories_burned: number | null;
  notes: string | null;
};

// ── Body, recovery, goals, achievements ────────────────────────────────────
export type BodyMeasurement = {
  id: UUID;
  user_id: UUID;
  measured_on: ISODate;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  hip_cm: number | null;
  body_fat_pct: number | null;
};

export type RecoveryLog = {
  id: UUID;
  user_id: UUID;
  log_date: ISODate;
  energy: number | null;
  stress: number | null;
  soreness: number | null;
  overall: number | null;
  recovery_score: number | null;
};

export type Goal = {
  id: UUID;
  user_id: UUID;
  goal_type: GoalType;
  title: string;
  metric: string;
  direction: "increase" | "decrease";
  exercise_id: number | null;
  start_date: ISODate;
  target_date: ISODate | null;
  start_value: number | null;
  current_value: number | null;
  target_value: number;
  unit: string | null;
  status: GoalStatus;
};

export type Achievement = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  metric: string;
  threshold: number;
  unlocked_at?: ISOTimestamp | null;
};

// ── AI ─────────────────────────────────────────────────────────────────────
/** Facts come from the database; recommendation is model output. They are never mixed. */
export type AIInsight = {
  id: UUID;
  insight_date: ISODate;
  kind: string;
  facts: Record<string, unknown>;
  recommendation: string;
  missing_data: string[];
};
