import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import {
  calculateNutrition,
  calculateRecipeNutrition,
  matchStoredOption,
  resolvePortion,
  toBaseAmount,
  type ResolvedIngredient,
} from "@/lib/calculations/nutrition";
import { loadFoodRefs } from "@/features/nutrition/refs";
import { refKey, type FoodRef, type IngredientDraft } from "@/features/nutrition/types";
import type { CustomFoodInput, RecipeInput } from "@/lib/validations/nutrition";

const n = (v: unknown) => Number(v ?? 0);

type IngredientInput = RecipeInput["ingredients"][number];
type Resolved = ResolvedIngredient & { ref: FoodRef; quantity: number; unitCode: string };

/** Resolve every ingredient against database values (one batch load). Client totals are ignored. */
async function resolveIngredients(ingredients: IngredientInput[]): Promise<Resolved[]> {
  const refs: FoodRef[] = ingredients.map((i) => ({ kind: i.kind, id: i.id }));
  const loaded = await loadFoodRefs(refs);
  const byKey = new Map(loaded.map((f) => [refKey(f), f]));
  return ingredients.map((i) => {
    const food = byKey.get(refKey({ kind: i.kind, id: i.id }));
    if (!food) throw new AppError("not_found", "One of the ingredients could not be found.", 404);
    const option = resolvePortion(food.options, i.portion.unitCode, i.portion.servingId);
    const baseAmount = toBaseAmount(i.portion.quantity, option);
    return { ref: { kind: i.kind, id: i.id }, quantity: i.portion.quantity, unitCode: option.unitCode, baseAmount, nutrition: calculateNutrition(food.per, baseAmount) };
  });
}

// ── Custom foods ─────────────────────────────────────────────────────────────

export async function saveCustomFood(input: CustomFoodInput): Promise<string> {
  const supabase = await createClient();
  let food: Record<string, unknown>;
  let ingredients: Record<string, unknown>[] = [];

  if (input.mode === "manual" && input.manual) {
    const m = input.manual;
    food = { name: input.name, brand: input.brand ?? "", description: input.description ?? "", base_quantity: m.baseQuantity, base_unit: m.baseUnit, calories: m.calories, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, fiber_g: m.fiber_g, is_composite: false };
  } else {
    const resolved = await resolveIngredients(input.ingredients ?? []);
    const r = calculateRecipeNutrition(resolved, 1);
    // A composite food is stored as its totals over its total weight; "1 portion" = the whole thing.
    food = { name: input.name, brand: input.brand ?? "", description: input.description ?? "", base_quantity: r.totalWeight, base_unit: "g", ...r.total, is_composite: true };
    ingredients = resolved.map((i) => ({ food_item_id: Number(i.ref.id), quantity: i.quantity, unit_code: i.unitCode, base_amount: i.baseAmount }));
  }

  const { data, error } = await supabase.rpc("save_custom_food", { p_id: input.id ?? null, p_food: food, p_ingredients: ingredients });
  if (error) throw error;
  return data as string;
}

export async function deleteCustomFood(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("custom_foods").delete().eq("id", id).select("id");
  if (error) {
    if (error.code === "23503") throw new AppError("conflict", "This food is used in a recipe. Remove it from the recipe first.", 409);
    throw error;
  }
  if (!data?.length) throw new AppError("not_found", "We could not find that food.", 404);
}

export async function listCustomFoods() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("custom_foods").select("id, name, brand, base_quantity, base_unit, calories, protein_g, carbs_g, fat_g, is_composite").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, base_quantity: n(r.base_quantity), calories: n(r.calories), protein_g: n(r.protein_g), carbs_g: n(r.carbs_g), fat_g: n(r.fat_g) }));
}

async function draftsFor(rows: { food_item_id?: number | null; custom_food_id?: string | null; quantity: unknown; unit_code: string; base_amount: unknown }[]): Promise<IngredientDraft[]> {
  const refs: FoodRef[] = rows.map((r) => (r.food_item_id ? { kind: "food", id: String(r.food_item_id) } : { kind: "custom", id: String(r.custom_food_id) }));
  const loaded = new Map((await loadFoodRefs(refs)).map((f) => [refKey(f), f]));
  const drafts: IngredientDraft[] = [];
  rows.forEach((row, idx) => {
    const ref = loaded.get(refKey(refs[idx]!));
    if (!ref) return; // ingredient deleted from the database: skip rather than crash the editor
    const opt = matchStoredOption(ref.options, row.unit_code, n(row.quantity), n(row.base_amount));
    if (opt) drafts.push({ ref, quantity: n(row.quantity), optionKey: opt.key });
  });
  return drafts;
}

export async function getCustomFoodForEdit(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("custom_foods").select("*, custom_food_ingredients(*)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const ings = ((data.custom_food_ingredients ?? []) as { position: number; food_item_id: number; quantity: unknown; unit_code: string; base_amount: unknown }[]).sort((a, b) => a.position - b.position);
  return {
    id: data.id as string,
    name: data.name as string,
    brand: (data.brand as string) ?? "",
    description: (data.description as string) ?? "",
    isComposite: Boolean(data.is_composite),
    manual: { baseQuantity: n(data.base_quantity), baseUnit: data.base_unit as "g" | "ml", calories: n(data.calories), protein_g: n(data.protein_g), carbs_g: n(data.carbs_g), fat_g: n(data.fat_g), fiber_g: n(data.fiber_g) },
    ingredients: await draftsFor(ings),
  };
}

// ── Recipes ──────────────────────────────────────────────────────────────────

export async function saveRecipe(input: RecipeInput): Promise<string> {
  const supabase = await createClient();
  const resolved = await resolveIngredients(input.ingredients);
  const r = calculateRecipeNutrition(resolved, input.servings);
  const recipe = { name: input.name, description: input.description ?? "", instructions: input.instructions ?? "", servings: input.servings, total_calories: r.total.calories, total_protein_g: r.total.protein_g, total_carbs_g: r.total.carbs_g, total_fat_g: r.total.fat_g, total_fiber_g: r.total.fiber_g };
  const ingredients = resolved.map((i) => ({
    food_item_id: i.ref.kind === "food" ? Number(i.ref.id) : "",
    custom_food_id: i.ref.kind === "custom" ? i.ref.id : "",
    quantity: i.quantity,
    unit_code: i.unitCode,
    base_amount: i.baseAmount,
  }));
  const { data, error } = await supabase.rpc("save_recipe", { p_id: input.id ?? null, p_recipe: recipe, p_ingredients: ingredients });
  if (error) throw error;
  return data as string;
}

export async function deleteRecipe(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new AppError("not_found", "We could not find that recipe.", 404);
}

export async function listRecipes() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").select("id, name, servings, total_calories, total_protein_g, total_carbs_g, total_fat_g").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const s = n(r.servings) || 1;
    return { id: r.id as string, name: r.name as string, servings: s, perServing: { calories: Math.round(n(r.total_calories) / s), protein_g: Math.round((n(r.total_protein_g) / s) * 10) / 10, carbs_g: Math.round((n(r.total_carbs_g) / s) * 10) / 10, fat_g: Math.round((n(r.total_fat_g) / s) * 10) / 10 } };
  });
}

export async function getRecipeForEdit(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").select("*, recipe_ingredients(*)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const ings = ((data.recipe_ingredients ?? []) as { position: number; food_item_id: number | null; custom_food_id: string | null; quantity: unknown; unit_code: string; base_amount: unknown }[]).sort((a, b) => a.position - b.position);
  return {
    id: data.id as string,
    name: data.name as string,
    description: (data.description as string) ?? "",
    instructions: (data.instructions as string) ?? "",
    servings: n(data.servings),
    ingredients: await draftsFor(ings),
  };
}

// ── Favorites ────────────────────────────────────────────────────────────────

export async function toggleFavorite(userId: string, ref: FoodRef): Promise<{ isFavorite: boolean }> {
  const supabase = await createClient();
  const col = ref.kind === "food" ? "food_item_id" : ref.kind === "custom" ? "custom_food_id" : "recipe_id";
  const value = ref.kind === "food" ? Number(ref.id) : ref.id;

  const { data: existing, error } = await supabase.from("favorite_foods").select("id").eq(col, value).maybeSingle();
  if (error) throw error;

  if (existing) {
    const { error: delErr } = await supabase.from("favorite_foods").delete().eq("id", existing.id);
    if (delErr) throw delErr;
    return { isFavorite: false };
  }
  const { error: insErr } = await supabase.from("favorite_foods").insert({ user_id: userId, [col]: value });
  if (insErr) throw insErr;
  return { isFavorite: true };
}

