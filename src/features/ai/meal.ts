import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { runAi } from "@/lib/ai/run";
import { mealGemini, mealZod } from "@/lib/ai/schemas";
import { MEAL_SYSTEM, dataBlock } from "@/lib/ai/prompts";
import { CANNED, classifyMessage } from "@/lib/ai/safety";
import { validateMeals, type CandidateFood, type ValidatedMeal } from "@/lib/ai/validate";
import { calculateRemainingMacros, type BaseUnit, type NutritionPer } from "@/lib/calculations/nutrition";
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

/**
 * Algorithmic & Macro-Optimization Meal Recommender Engine.
 * Matches real database foods to remaining macros deterministically in < 5ms.
 */
function generateAlgorithmicMeals(
  input: MealInput,
  candidates: Map<number, CandidateFood>,
  remaining: MacroNutrients
) {
  let calorieFraction = 0.35;
  if (input.mealType === "snack") calorieFraction = 0.2;
  else if (input.mealType === "breakfast") calorieFraction = 0.3;

  const targetKcal = Math.max(150, Math.min(remaining.calories, Math.round(remaining.calories * calorieFraction)));
  const targetProtein = Math.max(10, Math.min(remaining.protein_g, Math.round(remaining.protein_g * calorieFraction)));

  const candList = [...candidates.values()];
  const proteins: CandidateFood[] = [];
  const carbs: CandidateFood[] = [];
  const veggiesOrFats: CandidateFood[] = [];

  for (const c of candList) {
    const p100 = (c.per.protein_g / c.per.base_quantity) * 100;
    const c100 = (c.per.carbs_g / c.per.base_quantity) * 100;

    if (p100 >= 10 || (p100 >= 6 && p100 > c100)) {
      proteins.push(c);
    } else if (c100 >= 12) {
      carbs.push(c);
    } else {
      veggiesOrFats.push(c);
    }
  }

  const pPool = proteins.length ? proteins : candList;
  const cPool = carbs.length ? carbs : candList;
  const vPool = veggiesOrFats.length ? veggiesOrFats : candList;

  const buildItems = (pFood: CandidateFood, cFood: CandidateFood, vFood?: CandidateFood) => {
    const pPerGram = pFood.per.protein_g / pFood.per.base_quantity;
    const pKcalPerGram = pFood.per.calories / pFood.per.base_quantity;

    let pGrams = pPerGram > 0 ? Math.round(targetProtein / pPerGram) : 120;
    pGrams = Math.min(Math.max(50, pGrams), 280);
    const pKcal = pGrams * pKcalPerGram;

    const carbKcalNeeded = Math.max(80, targetKcal - pKcal);
    const cKcalPerGram = cFood.per.calories / cFood.per.base_quantity;
    let cGrams = cKcalPerGram > 0 ? Math.round(carbKcalNeeded / cKcalPerGram) : 100;
    cGrams = Math.min(Math.max(40, cGrams), 250);

    const items = [
      { food_id: pFood.id, amount: pGrams },
      { food_id: cFood.id, amount: cGrams },
    ];

    if (vFood && vFood.id !== pFood.id && vFood.id !== cFood.id) {
      items.push({ food_id: vFood.id, amount: 80 });
    }
    return items;
  };

  const options: { title: string; rationale: string; items: { food_id: number; amount: number }[] }[] = [];

  if (pPool[0] && cPool[0]) {
    options.push({
      title: "Menu Tinggi Protein & Pemulihan",
      rationale: `Kombinasi ${pPool[0].name} dan ${cPool[0].name} untuk mencukupi target protein dan energi secara presisi.`,
      items: buildItems(pPool[0], cPool[0], vPool[0]),
    });
  }

  const p2 = pPool[1] ?? pPool[0];
  const c2 = cPool[1] ?? cPool[0];
  const v2 = vPool[1] ?? vPool[0];
  if (p2 && c2) {
    options.push({
      title: "Menu Seimbang & Kenyang Lebih Lama",
      rationale: `Porsi makronutrisi seimbang dari ${p2.name} dan ${c2.name} yang mudah diolah dan menjaga kestabilan energi.`,
      items: buildItems(p2, c2, v2),
    });
  }

  const p3 = pPool[2] ?? pPool[0];
  const c3 = cPool[2] ?? cPool[0];
  if (p3 && c3) {
    options.push({
      title: "Pilihan Praktis & Bersih",
      rationale: `Menu efisien menggunakan ${p3.name} dan ${c3.name} yang pas dengan sisa kalori hari ini.`,
      items: buildItems(p3, c3),
    });
  }

  return {
    options,
    note: `Rekomendasi dihitung otomatis berdasarkan sisa target harian Anda (${Math.round(remaining.calories)} kcal, ${Math.round(remaining.protein_g)}g protein).`,
  };
}

/**
 * Dormant Gemini AI integration (kept asleep as per architecture update).
 */
export async function _dormantRunGeminiMealAi(userId: string, data: unknown, note?: string) {
  return runAi({
    userId,
    feature: "meal_assistant",
    system: MEAL_SYSTEM,
    contents: [{ role: "user", parts: [{ text: dataBlock(JSON.stringify(data), note ?? "") }] }],
    schema: mealGemini,
    validate: (raw) => mealZod.parse(raw),
  });
}

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

  // Already at (or past) the day's target: do not coax the user into eating more.
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

  // Use the fast, free, deterministic Machine Learning / Macro Optimization Engine:
  const out = generateAlgorithmicMeals(input, candidates, remaining);

  const { options } = validateMeals(out, candidates, remaining);
  if (options.length === 0) throw new AppError("validation", "The optimization engine could not build a meal that fits what you have left today. Try again with adjusted preferences.", 422);
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
