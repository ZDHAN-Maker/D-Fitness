/**
 * Turns what the model proposed into something safe to show. PURE: no I/O.
 *  - ids must come from the candidate lists we supplied (the model cannot invent foods or exercises),
 *  - amounts are bounded,
 *  - every nutrition number is recomputed here from database values, never taken from the model.
 */
import { calculateMacroTotals, calculateNutrition, round1, round2, type NutritionPer } from "@/lib/calculations/nutrition";
import { AiProviderError } from "@/lib/ai/gemini";
import type { MealRaw, ScanRaw, WorkoutRaw } from "@/lib/ai/schemas";
import type { MacroNutrients, TrackingMode } from "@/types/domain";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ── Meals ────────────────────────────────────────────────────────────────────────────
export type CandidateFood = { id: number; name: string; per: NutritionPer };
export type ValidatedMeal = {
  title: string;
  rationale: string;
  items: { foodId: number; name: string; amount: number; unit: "g" | "ml"; nutrition: MacroNutrients }[];
  totals: MacroNutrients;
  /** Share of the REMAINING protein this meal covers (0–1+). */
  proteinShare: number;
};

export const MEAL_AMOUNT = { min: 5, max: 1000 } as const;

export function validateMeals(raw: MealRaw, candidates: ReadonlyMap<number, CandidateFood>, remaining: MacroNutrients, maxOptions = 3): { options: ValidatedMeal[]; dropped: number } {
  const options: ValidatedMeal[] = [];
  let dropped = 0;
  for (const o of raw.options) {
    const seen = new Set<number>();
    const items: ValidatedMeal["items"] = [];
    for (const it of o.items) {
      const food = candidates.get(it.food_id);
      if (!food || seen.has(it.food_id) || !Number.isFinite(it.amount) || it.amount < MEAL_AMOUNT.min || it.amount > MEAL_AMOUNT.max) {
        dropped++;
        continue;
      }
      seen.add(it.food_id);
      const amount = round1(it.amount);
      items.push({ foodId: food.id, name: food.name, amount, unit: food.per.base_unit, nutrition: calculateNutrition(food.per, amount) });
    }
    if (items.length === 0) continue;
    const totals = calculateMacroTotals(items.map((i) => i.nutrition));
    // Too small to be a meal, or far more than what is left in the day: not offered.
    if (totals.calories < 60 || totals.calories > remaining.calories * 1.2 + 25) {
      dropped++;
      continue;
    }
    options.push({ title: o.title, rationale: o.rationale, items, totals, proteinShare: remaining.protein_g > 0 ? round2(totals.protein_g / remaining.protein_g) : 0 });
    if (options.length >= maxOptions) break;
  }
  return { options, dropped };
}

// ── Workouts ─────────────────────────────────────────────────────────────────────────
export type CandidateExercise = { id: number; name: string; tracking_mode: TrackingMode; primary_muscle: string | null; equipment: string | null };
export type ValidatedWorkout = {
  title: string;
  rationale: string;
  exercises: { exerciseId: number; name: string; muscle: string | null; sets: number; repsMin: number | null; repsMax: number | null; durationSec: number | null; restSeconds: number; note: string }[];
  estimatedMinutes: number;
  trimmed: boolean;
  recoveryCapped: boolean;
};

const TIMED: TrackingMode[] = ["duration", "distance_duration", "weight_duration"];
export const isTimed = (m: TrackingMode) => TIMED.includes(m);

function minutesFor(e: ValidatedWorkout["exercises"][number]): number {
  const work = e.durationSec ?? (((e.repsMin ?? 8) + (e.repsMax ?? e.repsMin ?? 8)) / 2) * 3; // ~3 s per rep
  return (e.sets * (work + e.restSeconds) + 30) / 60; // + 30 s to set up the next exercise
}
export const estimateMinutes = (list: ValidatedWorkout["exercises"]) => Math.round(list.reduce((a, e) => a + minutesFor(e), 0));

export function validateWorkout(raw: WorkoutRaw, candidates: ReadonlyMap<number, CandidateExercise>, ctx: { minutes: number; recoveryLow: boolean }): ValidatedWorkout {
  const seen = new Set<number>();
  let recoveryCapped = false;
  let list: ValidatedWorkout["exercises"] = [];

  for (const e of raw.exercises) {
    const c = candidates.get(e.exercise_id);
    if (!c || seen.has(c.id) || !Number.isFinite(e.sets)) continue;
    seen.add(c.id);
    let sets = clamp(Math.round(e.sets), 1, 6);
    if (ctx.recoveryLow && sets > 3) {
      sets = 3;
      recoveryCapped = true;
    }
    const timed = isTimed(c.tracking_mode);
    const repsMin = timed ? null : clamp(Math.round(e.reps_min ?? 8), 1, 50);
    const repsMax = timed ? null : clamp(Math.round(Math.max(e.reps_max ?? (repsMin as number) + 4, repsMin as number)), repsMin as number, 60);
    const durationSec = timed ? clamp(Math.round(e.duration_sec ?? (c.tracking_mode === "distance_duration" ? 600 : 45)), 10, 1800) : null;
    list.push({ exerciseId: c.id, name: c.name, muscle: c.primary_muscle, sets, repsMin, repsMax, durationSec, restSeconds: clamp(Math.round(e.rest_seconds ?? 60), 15, 240), note: e.note });
  }

  // Fit the available time: never more exercises than the time allows, and trim from the end until it fits.
  const maxExercises = clamp(Math.floor(ctx.minutes / 6), 2, 10);
  let trimmed = list.length > maxExercises;
  list = list.slice(0, maxExercises);
  while (list.length > 2 && estimateMinutes(list) > ctx.minutes + 2) {
    list.pop();
    trimmed = true;
  }
  if (list.length < 2) throw new AiProviderError("invalid_output", "The generated workout was not usable.");

  // Still too long with the minimum number of exercises? First take sets away (biggest block first, never below 2)...
  while (estimateMinutes(list) > ctx.minutes + 2) {
    const idx = list.reduce((best, e, i) => (e.sets > list[best]!.sets ? i : best), 0);
    if (list[idx]!.sets <= 2) break;
    list[idx] = { ...list[idx]!, sets: list[idx]!.sets - 1 };
    trimmed = true;
  }
  // ...then shorten the longest rests (never below 30 s).
  while (estimateMinutes(list) > ctx.minutes + 2) {
    const idx = list.reduce((best, e, i) => (e.restSeconds > list[best]!.restSeconds ? i : best), 0);
    if (list[idx]!.restSeconds <= 30) break;
    list[idx] = { ...list[idx]!, restSeconds: Math.max(30, list[idx]!.restSeconds - 15) };
    trimmed = true;
  }

  return { title: raw.title, rationale: raw.rationale, exercises: list, estimatedMinutes: estimateMinutes(list), trimmed, recoveryCapped };
}

// ── Food scan ────────────────────────────────────────────────────────────────────────
export type DetectedItem = { name: string; searchTerms: string[]; estimatedGrams: number; confidence: number; preparation: string };

export function normalizeScan(raw: ScanRaw): { isFood: boolean; notes: string; items: DetectedItem[] } {
  if (!raw.is_food) return { isFood: false, notes: raw.notes, items: [] };
  const items = raw.items
    .filter((i) => Number.isFinite(i.estimated_grams) && i.estimated_grams > 0)
    .slice(0, 8)
    .map((i) => {
      const terms = [...new Set([i.name, ...i.search_terms].map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 4);
      return { name: i.name, searchTerms: terms, estimatedGrams: round1(clamp(i.estimated_grams, 5, 1500)), confidence: round2(clamp(Number.isFinite(i.confidence) ? i.confidence : 0.5, 0, 1)), preparation: i.preparation };
    });
  return { isFood: items.length > 0, notes: raw.notes, items };
}
