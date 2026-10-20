import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { calculateMacroTotals, calculateNutrition, resolvePortion, toBaseAmount } from "@/lib/calculations/nutrition";
import { loadFoodRefs } from "@/features/nutrition/refs";
import { refKey, type DiaryItem, type DiaryMeal, type FoodRef } from "@/features/nutrition/types";
import type { LogFoodInput, UpdateLogItemInput } from "@/lib/validations/nutrition";
import type { MealType } from "@/types/domain";

import { MEAL_ORDER } from "@/features/nutrition/meals";

const n = (v: unknown) => Number(v ?? 0);

/** One query for the whole day; refs for editing are batch-loaded (fixed query count). */
export async function getDiary(date: string): Promise<{ meals: DiaryMeal[]; totals: ReturnType<typeof calculateMacroTotals>; itemCount: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("food_logs")
    .select("id, meal_type, food_log_items(*)")
    .eq("logged_on", date);
  if (error) throw error;

  type ItemRow = Record<string, unknown>;
  const rows = (data ?? []).flatMap((l) =>
    ((l.food_log_items ?? []) as ItemRow[]).map((i) => ({ meal: l.meal_type as MealType, row: i })),
  );

  const refOf = (r: ItemRow): FoodRef | null =>
    r.food_item_id ? { kind: "food", id: String(r.food_item_id) } : r.custom_food_id ? { kind: "custom", id: String(r.custom_food_id) } : r.recipe_id ? { kind: "recipe", id: String(r.recipe_id) } : null;

  const refs = rows.map((x) => refOf(x.row)).filter((r): r is FoodRef => r !== null);
  const loaded = await loadFoodRefs(refs);
  const byKey = new Map(loaded.map((f) => [refKey(f), f]));

  const toItem = (r: ItemRow): DiaryItem => {
    const ref = refOf(r);
    return {
      id: String(r.id),
      source: String(r.source),
      name_snapshot: String(r.name_snapshot),
      quantity: n(r.quantity),
      unit_code: String(r.unit_code),
      base_amount: n(r.base_amount),
      calories: n(r.calories),
      protein_g: n(r.protein_g),
      carbs_g: n(r.carbs_g),
      fat_g: n(r.fat_g),
      fiber_g: n(r.fiber_g),
      ref: ref ? (byKey.get(refKey(ref)) ?? null) : null,
    };
  };

  const meals: DiaryMeal[] = MEAL_ORDER.map((meal) => {
    const items = rows
      .filter((x) => x.meal === meal)
      .sort((a, b) => String(a.row.created_at).localeCompare(String(b.row.created_at)))
      .map((x) => toItem(x.row));
    return { meal, items, totals: calculateMacroTotals(items) };
  });

  const all = meals.flatMap((m) => m.items);
  return { meals, totals: calculateMacroTotals(all), itemCount: all.length };
}

async function ensureFoodLog(userId: string, date: string, meal: MealType): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("food_logs")
    .upsert({ user_id: userId, logged_on: date, meal_type: meal }, { onConflict: "user_id,logged_on,meal_type" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Nutrition is ALWAYS computed here from database values; client-sent numbers are not accepted. */
export async function addLogItem(userId: string, input: LogFoodInput, meta?: { source: "ai_scan"; scanId: string }) {
  const [food] = await loadFoodRefs([input.ref]);
  if (!food) throw new AppError("not_found", "We could not find that food.", 404);

  const option = resolvePortion(food.options, input.portion.unitCode, input.portion.servingId);
  const baseAmount = toBaseAmount(input.portion.quantity, option);
  if (baseAmount <= 0) throw new AppError("validation", "That amount is too small.");
  const nutrition = calculateNutrition(food.per, baseAmount);

  const logId = await ensureFoodLog(userId, input.date, input.mealType);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("food_log_items")
    .insert({
      food_log_id: logId,
      source: meta?.source ?? (food.kind === "food" ? "database" : food.kind),
      ai_scan_id: meta?.scanId ?? null,
      food_item_id: food.kind === "food" ? Number(food.id) : null,
      custom_food_id: food.kind === "custom" ? food.id : null,
      recipe_id: food.kind === "recipe" ? food.id : null,
      name_snapshot: food.name,
      quantity: input.portion.quantity,
      unit_code: option.unitCode,
      base_amount: baseAmount,
      ...nutrition,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { itemId: data.id as string, nutrition };
}

export async function updateLogItem(userId: string, input: UpdateLogItemInput) {
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("food_log_items")
    .select("*, food_logs!inner(logged_on, meal_type)")
    .eq("id", input.itemId)
    .maybeSingle();
  if (error) throw error;
  if (!item) throw new AppError("not_found", "We could not find that entry.", 404);

  const patch: Record<string, unknown> = {};

  if (input.portion) {
    const ref: FoodRef | null = item.food_item_id ? { kind: "food", id: String(item.food_item_id) } : item.custom_food_id ? { kind: "custom", id: item.custom_food_id } : item.recipe_id ? { kind: "recipe", id: item.recipe_id } : null;
    const [food] = ref ? await loadFoodRefs([ref]) : [];
    if (!food) throw new AppError("conflict", "This food no longer exists, so its amount cannot be changed. Delete the entry and add it again.", 409);
    const option = resolvePortion(food.options, input.portion.unitCode, input.portion.servingId);
    const baseAmount = toBaseAmount(input.portion.quantity, option);
    Object.assign(patch, { quantity: input.portion.quantity, unit_code: option.unitCode, base_amount: baseAmount, ...calculateNutrition(food.per, baseAmount) });
  }

  const current = item.food_logs as { logged_on: string; meal_type: MealType };
  if (input.mealType && input.mealType !== current.meal_type) {
    patch.food_log_id = await ensureFoodLog(userId, current.logged_on, input.mealType);
  }

  const { error: upErr } = await supabase.from("food_log_items").update(patch).eq("id", input.itemId);
  if (upErr) throw upErr;
}

export async function deleteLogItem(itemId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("food_log_items").delete().eq("id", itemId).select("id");
  if (error) throw error;
  if (!data?.length) throw new AppError("not_found", "We could not find that entry.", 404);
}

/** Streak + achievements are best-effort side effects: they must never fail a successful log. */
export async function afterFoodLogged(date: string, userToday: string) {
  try {
    const supabase = await createClient();
    if (date === userToday) await supabase.rpc("update_streak", { p_type: "nutrition", p_date: date });
    await supabase.rpc("evaluate_achievements");
  } catch (e) {
    console.error("[after-food-logged]", e);
  }
}
