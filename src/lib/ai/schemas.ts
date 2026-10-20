/**
 * What the model is ASKED to return (Gemini responseSchema) and what we ACCEPT (Zod). The model's JSON is never
 * trusted: every field is re-validated, ids are checked against the candidate lists we supplied, and all nutrition
 * numbers are recomputed by our own calculators.
 */
import { z } from "zod";

const S = { str: { type: "STRING" }, num: { type: "NUMBER" }, int: { type: "INTEGER" }, bool: { type: "BOOLEAN" } } as const;
const arr = (items: object) => ({ type: "ARRAY", items });
const obj = (properties: Record<string, object>, required: string[]) => ({ type: "OBJECT", properties, required });

// ── Coach / insight ────────────────────────────────────────────────────────────────
export const coachGemini = obj(
  {
    answer: { ...S.str, description: "The reply to the user, plain text, short paragraphs." },
    recommendations: { ...arr(S.str), description: "0-5 concrete, actionable recommendations." },
    missing_data: { ...arr(S.str), description: "Data the user asked about that is NOT available in <data>." },
    needs_professional: { ...S.bool, description: "True if a healthcare professional should be consulted." },
  },
  ["answer", "recommendations", "missing_data", "needs_professional"],
);
export const coachZod = z.object({
  answer: z.string().trim().min(1).max(3000),
  recommendations: z.array(z.string().trim().min(1).max(400)).max(6).default([]),
  missing_data: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  needs_professional: z.boolean().default(false),
});
export type CoachOutput = z.infer<typeof coachZod>;

// ── Meal assistant ──────────────────────────────────────────────────────────────────
export const mealGemini = obj(
  {
    options: arr(
      obj(
        {
          title: { ...S.str, description: "Short meal name." },
          rationale: { ...S.str, description: "One or two sentences on why it fits the remaining targets." },
          items: arr(obj({ food_id: { ...S.int, description: "id from the candidate list ONLY" }, amount: { ...S.num, description: "amount in the food's own unit (g or ml)" } }, ["food_id", "amount"])),
        },
        ["title", "rationale", "items"],
      ),
    ),
    note: S.str,
  },
  ["options", "note"],
);
export const mealZod = z.object({
  options: z.array(z.object({ title: z.string().trim().min(1).max(120), rationale: z.string().trim().max(500).default(""), items: z.array(z.object({ food_id: z.number().int(), amount: z.number() })).min(1).max(10) })).min(1).max(6),
  note: z.string().trim().max(500).nullish().transform((v) => v ?? ""),
});
export type MealRaw = z.infer<typeof mealZod>;

// ── Workout generator ────────────────────────────────────────────────────────────────
export const workoutGemini = obj(
  {
    title: S.str,
    rationale: { ...S.str, description: "Why this session fits the time, goal, equipment and recovery." },
    exercises: arr(
      obj(
        {
          exercise_id: { ...S.int, description: "id from the candidate list ONLY" },
          sets: S.int,
          reps_min: { ...S.int, description: "omit/0 for timed exercises" },
          reps_max: S.int,
          duration_sec: { ...S.int, description: "only for timed exercises" },
          rest_seconds: S.int,
          note: S.str,
        },
        ["exercise_id", "sets"],
      ),
    ),
  },
  ["title", "rationale", "exercises"],
);
const optInt = z.number().nullish().transform((v) => (v === null || v === undefined || !Number.isFinite(v) ? null : v));
export const workoutZod = z.object({
  title: z.string().trim().min(1).max(80),
  rationale: z.string().trim().max(600).default(""),
  exercises: z.array(z.object({ exercise_id: z.number().int(), sets: z.number(), reps_min: optInt, reps_max: optInt, duration_sec: optInt, rest_seconds: optInt, note: z.string().trim().max(200).nullish().transform((v) => v ?? "") })).min(1).max(16),
});
export type WorkoutRaw = z.infer<typeof workoutZod>;

// ── Weekly review ────────────────────────────────────────────────────────────────────
export const reviewGemini = obj(
  {
    went_well: { ...arr(S.str), description: "1-4 things that went well, citing real numbers from <data>." },
    needs_improvement: { ...arr(S.str), description: "1-4 areas to improve." },
    recommendations: { ...arr(S.str), description: "2-4 concrete recommendations for next week." },
    missing_data: arr(S.str),
  },
  ["went_well", "needs_improvement", "recommendations", "missing_data"],
);
const bullets = z.array(z.string().trim().min(1).max(400)).max(6).default([]);
export const reviewZod = z.object({ went_well: bullets, needs_improvement: bullets, recommendations: bullets, missing_data: z.array(z.string().trim().min(1).max(200)).max(10).default([]) });
export type ReviewOutput = z.infer<typeof reviewZod>;

// ── Food scanner ──────────────────────────────────────────────────────────────────────
export const scanGemini = obj(
  {
    is_food: { ...S.bool, description: "False if the photo does not show food or drink." },
    notes: { ...S.str, description: "Anything the user should double-check (hidden ingredients, sauces, uncertain portions)." },
    items: arr(
      obj(
        {
          name: { ...S.str, description: "Common name of the food or dish." },
          search_terms: { ...arr(S.str), description: "2-3 short names a food database might use. Include the Indonesian name if the dish looks Indonesian." },
          estimated_grams: { ...S.num, description: "Estimated edible weight in grams (ml for drinks)." },
          confidence: { ...S.num, description: "0 to 1" },
          preparation: S.str,
        },
        ["name", "search_terms", "estimated_grams", "confidence"],
      ),
    ),
  },
  ["is_food", "notes", "items"],
);
export const scanZod = z.object({
  is_food: z.boolean(),
  notes: z.string().trim().max(500).nullish().transform((v) => v ?? ""),
  items: z.array(z.object({ name: z.string().trim().min(1).max(80), search_terms: z.array(z.string().trim().min(1).max(60)).max(6).default([]), estimated_grams: z.number(), confidence: z.number(), preparation: z.string().trim().max(80).nullish().transform((v) => v ?? "") })).max(14),
});
export type ScanRaw = z.infer<typeof scanZod>;
