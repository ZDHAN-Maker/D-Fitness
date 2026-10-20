import type { GoalType } from "@/types/domain";

/**
 * Every metric a goal can track. `auto` metrics are recalculated from your own data by
 * public.sync_progress() (see 016); `custom` goals are updated by hand.
 * `rate` metrics (per-day / per-week averages) start from 0; the others start from where you were.
 */
export type GoalMetric = {
  key: string;
  label: string;
  unit: string;
  type: GoalType;
  direction: "increase" | "decrease";
  auto: boolean;
  rate: boolean;
  needsExercise?: boolean;
  needsDistance?: boolean;
  hint?: string;
};

export const GOAL_METRICS: GoalMetric[] = [
  { key: "weight_kg", label: "Body weight", unit: "kg", type: "body", direction: "decrease", auto: true, rate: false, hint: "Follows your latest weight entry." },
  { key: "body_fat_pct", label: "Body fat", unit: "%", type: "body", direction: "decrease", auto: true, rate: false },
  { key: "waist_cm", label: "Waist", unit: "cm", type: "body", direction: "decrease", auto: true, rate: false },
  { key: "chest_cm", label: "Chest", unit: "cm", type: "body", direction: "increase", auto: true, rate: false },
  { key: "arm_cm", label: "Arm", unit: "cm", type: "body", direction: "increase", auto: true, rate: false },
  { key: "thigh_cm", label: "Thigh", unit: "cm", type: "body", direction: "increase", auto: true, rate: false },
  { key: "hip_cm", label: "Hip", unit: "cm", type: "body", direction: "decrease", auto: true, rate: false },
  { key: "one_rep_max_kg", label: "Estimated 1RM", unit: "kg", type: "strength", direction: "increase", auto: true, rate: false, needsExercise: true, hint: "Follows your best estimated 1RM for the exercise." },
  { key: "max_weight_kg", label: "Heaviest set", unit: "kg", type: "strength", direction: "increase", auto: true, rate: false, needsExercise: true },
  { key: "run_time_min", label: "Run time", unit: "min", type: "running", direction: "decrease", auto: true, rate: false, needsDistance: true, hint: "Estimated from the pace of runs at least that long." },
  { key: "monthly_run_km", label: "Distance this month", unit: "km", type: "running", direction: "increase", auto: true, rate: true },
  { key: "daily_protein_g", label: "Protein per day", unit: "g/day", type: "nutrition", direction: "increase", auto: true, rate: true, hint: "Average of your last 7 logged days." },
  { key: "daily_fiber_g", label: "Fibre per day", unit: "g/day", type: "nutrition", direction: "increase", auto: true, rate: true, hint: "Average of your last 7 logged days." },
  { key: "daily_water_ml", label: "Water per day", unit: "ml/day", type: "nutrition", direction: "increase", auto: true, rate: true, hint: "Average of your last 7 logged days." },
  { key: "workouts_per_week", label: "Workouts per week", unit: "sessions/week", type: "habit", direction: "increase", auto: true, rate: true },
  { key: "sleep_hours", label: "Sleep per night", unit: "h", type: "habit", direction: "increase", auto: true, rate: true, hint: "Average of your last 7 logged nights." },
];

export const CUSTOM_METRIC: GoalMetric = { key: "custom", label: "Custom (update by hand)", unit: "", type: "habit", direction: "increase", auto: false, rate: false };

export const GOAL_TYPES: { key: GoalType; label: string }[] = [
  { key: "body", label: "Body" },
  { key: "strength", label: "Strength" },
  { key: "running", label: "Running" },
  { key: "nutrition", label: "Nutrition" },
  { key: "habit", label: "Habit" },
];

export const metricsFor = (type: GoalType): GoalMetric[] => [...GOAL_METRICS.filter((m) => m.type === type), { ...CUSTOM_METRIC, type }];
export const findMetric = (key: string): GoalMetric | undefined => (key === "custom" ? CUSTOM_METRIC : GOAL_METRICS.find((m) => m.key === key));

export const RUN_DISTANCES = [
  { km: 1, label: "1 km" },
  { km: 3, label: "3 km" },
  { km: 5, label: "5K" },
  { km: 10, label: "10K" },
  { km: 21.1, label: "Half marathon" },
  { km: 42.2, label: "Marathon" },
];
