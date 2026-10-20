import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { runAi } from "@/lib/ai/run";
import { mealGemini, mealZod } from "@/lib/ai/schemas";
import { MEAL_SYSTEM, dataBlock } from "@/lib/ai/prompts";
import { CANNED, classifyMessage } from "@/lib/ai/safety";
import { validateMeals, type CandidateFood, type ValidatedMeal } from "@/lib/ai/validate";
import { calculateRemainingMacros, round1, type BaseUnit, type NutritionPer } from "@/lib/calculations/nutrition";
import { getProfileAndSettings } from "@/features/profile/queries";
import { getFavoriteRefs, getRecentRefs } from "@/features/nutrition/refs";
import { addLogItem, afterFoodLogged } from "@/features/nutrition/diary";
import { todayInTimeZone } from "@/utils/date";
import type { MacroNutrients, MealType } from "@/types/domain";
import type { MealInput } from "@/lib/validations/ai";

type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0);

export type MealSuggestion = {
  mealType: MealType;
  date: string;
  consumed: MacroNutrients;
  remaining: MacroNutrients;
  options: ValidatedMeal[];
  note: string;
  /** Set when no AI call was made (and why). */
  skipped?: "target_reached";
};

const REACHED_BELOW_KCAL = 150;

/** What is left today = targets - what the user actually logged (calculated here, never by the model). */
export async function suggestMeals(userId: string, input: MealInput): Promise<MealSuggestion> {
  if (input.note) {
    const c = classifyMessage(input.note);
    if (c === "emergency" || c === "eating_disorder" || c === "extreme_restriction") throw new AppError("validation", CANNED[c]);
  }
  const { profile, settings } = await getProfileAndSettings(userId);
  if (!profile || !settings) throw new AppError("conflict", "Your profile is still being created.", 409);
  const date = todayInTimeZone(profile.timezone);
  const supabase = await createClient();

  const [tot, prefsRes, cand, favs, recents] = await Promise.all([
    supabase.rpc("daily_nutrition_totals", { p_date: date }),
    supabase.from("user_preferences").select("dietary_restrictions, preferred_cuisines").maybeSingle(),
    supabase.rpc("meal_candidates", { p_per_category: 5, p_limit: 70 }),
    getFavoriteRefs(),
    getRecentRefs(10),
  ]);
  if (tot.error) throw tot.error;
  if (prefsRes.error) throw prefsRes.error;
  if (cand.error) throw cand.error;

  const t = ((tot.data as Row[] | null) ?? [])[0];
  const consumed: MacroNutrients = { calories: n(t?.calories), protein_g: n(t?.protein_g), carbs_g: n(t?.carbs_g), fat_g: n(t?.fat_g), fiber_g: n(t?.fiber_g) };
  const remaining = calculateRemainingMacros(consumed, { calories: settings.calorie_target, protein_g: settings.protein_target_g, carbs_g: settings.carbs_target_g, fat_g: settings.fat_target_g, fiber_g: settings.fiber_target_g });

  // Already at (or past) the day's target: do not coax the user into eating more, and do not spend an AI call.
  if (remaining.calories < REACHED_BELOW_KCAL) {
    return { mealType: input.mealType, date, consumed, remaining, options: [], note: "You've essentially reached today's calorie target, so there is nothing left to plan. Nice work.", skipped: "target_reached" };
  }

  // Candidates: a diverse DB sample + foods the user already eats (favourites and recents, master foods only).
  const familiar = new Set<number>();
  const candidates = new Map<number, CandidateFood>();
  for (const r of (cand.data ?? []) as Row[]) {
    const per: NutritionPer = { base_quantity: n(r.base_quantity) || 100, base_unit: (r.base_unit as BaseUnit) ?? "g", calories: n(r.calories), protein_g: n(r.protein_g), carbs_g: n(r.carbs_g), fat_g: n(r.fat_g), fiber_g: n(r.fiber_g) };
    candidates.set(Number(r.id), { id: Number(r.id), name: String(r.name), per });
  }
  for (const f of [...favs, ...recents]) {
    if (f.kind !== "food") continue;
    familiar.add(Number(f.id));
    if (!candidates.has(Number(f.id))) candidates.set(Number(f.id), { id: Number(f.id), name: f.name, per: f.per });
  }
  if (candidates.size === 0) throw new AppError("conflict", "There are no foods in the database to build a meal from yet.", 409);

  const ids = [...candidates.keys()];
  const { data: servings, error: sErr } = await supabase.from("food_servings").select("food_item_id, label, base_amount, is_default").in("food_item_id", ids).eq("is_default", true);
  if (sErr) throw sErr;
  const typical = new Map((servings ?? []).map((s) => [Number(s.food_item_id), `${s.label} = ${n(s.base_amount)}`]));

  const data = {
    meal: input.mealType,
    remaining_today: remaining,
    eaten_today: consumed,
    daily_targets: { calories: settings.calorie_target, protein_g: settings.protein_target_g },
    preferences: { dietary_restrictions: (prefsRes.data?.dietary_restrictions as string[]) ?? [], preferred_cuisines: (prefsRes.data?.preferred_cuisines as string[]) ?? [] },
    candidates: [...candidates.values()].map((c) => ({
      food_id: c.id,
      name: c.name,
      unit: c.per.base_unit,
      per_100: { kcal: round1((c.per.calories / c.per.base_quantity) * 100), protein: round1((c.per.protein_g / c.per.base_quantity) * 100), carbs: round1((c.per.carbs_g / c.per.base_quantity) * 100), fat: round1((c.per.fat_g / c.per.base_quantity) * 100) },
      typical_serving: typical.get(c.id) ?? null,
      familiar: familiar.has(c.id),
    })),
  };

  const { data: out } = await runAi({
    userId,
    feature: "meal_assistant",
    system: MEAL_SYSTEM,
    contents: [{ role: "user", parts: [{ text: dataBlock(JSON.stringify(data), input.note ?? "") }] }],
    schema: mealGemini,
    validate: (raw) => mealZod.parse(raw),
  });

  const { options } = validateMeals(out, candidates, remaining);
  if (options.length === 0) throw new AppError("validation", "The AI could not build a meal that fits what you have left today. Try again, or relax your note.", 422);
  return { mealType: input.mealType, date, consumed, remaining, options, note: out.note };
}

/** Logs a suggested meal using the foods' own database values (amounts are re-validated; nothing is trusted from the client). */
export async function logSuggestedMeal(userId: string, input: { date: string; mealType: MealType; items: { foodId: number; amount: number }[] }) {
  const supabase = await createClient();
  const ids = [...new Set(input.items.map((i) => i.foodId))];
  const { data, error } = await supabase.from("food_items").select("id, base_unit").in("id", ids);
  if (error) throw error;
  const units = new Map((data ?? []).map((f) => [Number(f.id), String(f.base_unit)]));
  for (const it of input.items) {
    const unit = units.get(it.foodId);
    if (!unit) throw new AppError("not_found", "One of the foods could not be found.", 404);
    await addLogItem(userId, { date: input.date, mealType: input.mealType, ref: { kind: "food", id: String(it.foodId) }, portion: { quantity: it.amount, unitCode: unit, servingId: null } });
  }
  const { profile } = await getProfileAndSettings(userId);
  await afterFoodLogged(input.date, todayInTimeZone(profile?.timezone ?? "UTC"));
}
