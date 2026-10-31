import type { Exercise } from "@/types/domain";

export type ExerciseLite = Pick<Exercise, "id" | "name" | "primary_muscle" | "equipment" | "tracking_mode"> & {
  video_url?: string | null;
};

export type SetView = {
  id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  duration_sec: number | null;
  distance_m: number | null;
  rpe: number | null;
  is_warmup: boolean;
  is_completed: boolean;
};

export type ExerciseTarget = {
  repsMin: number | null;
  repsMax: number | null;
  durationSec: number | null;
  weightKg: number | null;
  restSeconds: number | null;
};

export type SessionExerciseView = {
  id: string;
  position: number;
  exercise: ExerciseLite;
  sets: SetView[];
  target: ExerciseTarget | null;
};

export type SessionView = {
  id: string;
  plan_id: string | null;
  name: string;
  status: "in_progress" | "completed" | "cancelled";
  logged_on: string;
  started_at: string;
  ended_at: string | null;
  total_volume_kg: number | null;
  perceived_effort: number | null;
  notes: string | null;
  exercises: SessionExerciseView[];
};

export type PreviousPerformance = {
  date: string;
  sets: Pick<SetView, "weight_kg" | "reps" | "duration_sec" | "distance_m" | "is_warmup">[];
};

export type PlanSummary = { id: string; name: string; description: string | null; scheduled_days: number[]; exercise_count: number };

export type PlanEdit = {
  id: string;
  name: string;
  description: string;
  scheduledDays: number[];
  exercises: {
    exercise: ExerciseLite;
    targetSets: number;
    targetRepsMin: number | null;
    targetRepsMax: number | null;
    targetDurationSec: number | null;
    targetWeightKg: number | null;
    restSeconds: number | null;
    notes: string;
  }[];
};

export type RecordRow = {
  subject: { kind: "exercise" | "activity"; id: number; name: string };
  record_type: string;
  value: number;
  unit: string;
  achieved_on: string;
};
