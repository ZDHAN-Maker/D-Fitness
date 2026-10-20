import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  buildPortionOptions,
  calculateRecipeNutrition,
  recipeAsNutritionPer,
  type BaseUnit,
  type NutritionPer,
  type ServingDef,
  type UnitDef,
} from "@/lib/calculations/nutrition";
import { refKey, type FoodRef, type FoodResult } from "@/features/nutrition/types";

const n = (v: unknown) => Number(v ?? 0);

export const getUnits = cache(async (): Promise<UnitDef[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("units").select("code, name, kind, to_base_factor");
  if (error) throw error;
  return (data ?? []).map((u) => ({ code: u.code, name: u.name, kind: u.kind, to_base_factor: u.to_base_factor === null ? null : n(u.to_base_factor) }));
});

export const getCategories = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("food_categories").select("id, name, slug").order("sort_order").order("name");
  if (error) throw error;
  return (data ?? []) as { id: number; name: string; slug: string }[];
});

type Row = Record<string, unknown>;

const perOf = (r: Row): NutritionPer => ({
  base_quantity: n(r.base_quantity) || 100,
  base_unit: (r.base_unit as BaseUnit) ?? "g",
  calories: n(r.calories),
  protein_g: n(r.protein_g),
  carbs_g: n(r.carbs_g),
  fat_g: n(r.fat_g),
  fiber_g: n(r.fiber_g),
});

const summaryOf = (per: NutritionPer, label: string) => ({
  label,
  nutrition: { calories: per.calories, protein_g: per.protein_g, carbs_g: per.carbs_g, fat_g: per.fat_g, fiber_g: per.fiber_g },
});

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

/**
 * Batch-load any mix of foods, custom foods and recipes with their portion options.
 * Fixed number of queries regardless of how many refs are requested (no N+1).
 * Order of the input is preserved; refs that no longer exist (or are not yours: RLS) are skipped.
 */
export async function loadFoodRefs(refs: FoodRef[]): Promise<FoodResult[]> {
  if (refs.length === 0) return [];
  const supabase = await createClient();
  const ids = (kind: FoodRef["kind"]) => [...new Set(refs.filter((r) => r.kind === kind).map((r) => r.id))];
  const foodIds = ids("food").map(Number).filter(Number.isInteger);
  const customIds = ids("custom");
  const recipeIds = ids("recipe");

  const [units, foods, servings, customs, recipes, recipeWeights] = await Promise.all([
    getUnits(),
    foodIds.length ? supabase.from("food_items").select("*").in("id", foodIds) : Promise.resolve({ data: [], error: null }),
    foodIds.length ? supabase.from("food_servings").select("*").in("food_item_id", foodIds).order("sort_order") : Promise.resolve({ data: [], error: null }),
    customIds.length ? supabase.from("custom_foods").select("*").in("id", customIds) : Promise.resolve({ data: [], error: null }),
    recipeIds.length ? supabase.from("recipes").select("*").in("id", recipeIds) : Promise.resolve({ data: [], error: null }),
    recipeIds.length ? supabase.from("recipe_ingredients").select("recipe_id, base_amount").in("recipe_id", recipeIds) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [foods, servings, customs, recipes, recipeWeights]) if (r.error) throw r.error;

  const servingsByFood = new Map<number, ServingDef[]>();
  for (const s of (servings.data ?? []) as Row[]) {
    const list = servingsByFood.get(n(s.food_item_id)) ?? [];
    list.push({ id: n(s.id), label: String(s.label), unit_code: String(s.unit_code), quantity: n(s.quantity), base_amount: n(s.base_amount), is_default: Boolean(s.is_default) });
    servingsByFood.set(n(s.food_item_id), list);
  }
  const weightByRecipe = new Map<string, number>();
  for (const w of (recipeWeights.data ?? []) as Row[]) {
    weightByRecipe.set(String(w.recipe_id), (weightByRecipe.get(String(w.recipe_id)) ?? 0) + n(w.base_amount));
  }

  const out = new Map<string, FoodResult>();

  for (const r of (foods.data ?? []) as Row[]) {
    const per = perOf(r);
    out.set(`food:${r.id}`, {
      kind: "food",
      id: String(r.id),
      name: String(r.name),
      brand: (r.brand as string) ?? null,
      per,
      options: buildPortionOptions(per, servingsByFood.get(n(r.id)) ?? [], units),
      summary: summaryOf(per, `${per.base_quantity} ${per.base_unit}`),
    });
  }

  for (const r of (customs.data ?? []) as Row[]) {
    const per = perOf(r);
    const composite = Boolean(r.is_composite);
    out.set(`custom:${r.id}`, {
      kind: "custom",
      id: String(r.id),
      name: String(r.name),
      brand: (r.brand as string) ?? null,
      per,
      options: buildPortionOptions(per, [], units, {
        label: composite ? `portion (${per.base_quantity} ${per.base_unit})` : `${per.base_quantity} ${per.base_unit} portion`,
        baseAmount: per.base_quantity,
      }),
      summary: summaryOf(per, composite ? "1 portion" : `${per.base_quantity} ${per.base_unit}`),
    });
  }

  for (const r of (recipes.data ?? []) as Row[]) {
    const servingsCount = n(r.servings) || 1;
    const weight = weightByRecipe.get(String(r.id)) ?? 0;
    const total = { calories: n(r.total_calories), protein_g: n(r.total_protein_g), carbs_g: n(r.total_carbs_g), fat_g: n(r.total_fat_g), fiber_g: n(r.total_fiber_g) };
    const calc = calculateRecipeNutrition([{ baseAmount: weight, nutrition: total }], servingsCount);
    const per = recipeAsNutritionPer({ total, totalWeight: weight });
    out.set(`recipe:${r.id}`, {
      kind: "recipe",
      id: String(r.id),
      name: String(r.name),
      brand: null,
      per,
      options: buildPortionOptions({ base_unit: "g" }, [], units, { label: `serving (${calc.weightPerServing} g)`, baseAmount: calc.weightPerServing }),
      summary: summaryOf({ ...per, ...calc.perServing }, "1 serving"),
    });
  }

  return refs.map((r) => out.get(refKey(r))).filter((x): x is FoodResult => Boolean(x));
}

export const getFavoriteKeys = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("favorite_foods").select("food_item_id, custom_food_id, recipe_id");
  if (error) throw error;
  const keys = new Set<string>();
  for (const f of data ?? []) {
    if (f.food_item_id) keys.add(`food:${f.food_item_id}`);
    else if (f.custom_food_id) keys.add(`custom:${f.custom_food_id}`);
    else if (f.recipe_id) keys.add(`recipe:${f.recipe_id}`);
  }
  return keys;
});

export async function withFavorites(items: FoodResult[]): Promise<FoodResult[]> {
  const fav = await getFavoriteKeys();
  return items.map((i) => ({ ...i, isFavorite: fav.has(refKey(i)) }));
}

export async function getFavoriteRefs(): Promise<FoodResult[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("favorite_foods").select("food_item_id, custom_food_id, recipe_id").order("created_at", { ascending: false }).limit(60);
  if (error) throw error;
  const refs: FoodRef[] = (data ?? []).map((f) =>
    f.food_item_id ? { kind: "food", id: String(f.food_item_id) } : f.custom_food_id ? { kind: "custom", id: String(f.custom_food_id) } : { kind: "recipe", id: String(f.recipe_id) },
  );
  return (await loadFoodRefs(refs)).map((r) => ({ ...r, isFavorite: true }));
}

/** Most recently logged distinct foods (food, custom and recipe), newest first. */
export async function getRecentRefs(limit = 10): Promise<FoodResult[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("food_log_items")
    .select("food_item_id, custom_food_id, recipe_id, created_at")
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  const seen = new Set<string>();
  const refs: FoodRef[] = [];
  for (const i of data ?? []) {
    const ref: FoodRef | null = i.food_item_id ? { kind: "food", id: String(i.food_item_id) } : i.custom_food_id ? { kind: "custom", id: String(i.custom_food_id) } : i.recipe_id ? { kind: "recipe", id: String(i.recipe_id) } : null;
    if (!ref || seen.has(refKey(ref))) continue;
    seen.add(refKey(ref));
    refs.push(ref);
    if (refs.length >= limit) break;
  }
  return withFavorites(await loadFoodRefs(refs));
}

/** Database-driven search. Never returns more than one page; the whole food table never leaves Postgres. */
export async function searchFoodRefs(opts: { q: string; categoryId?: number; offset?: number; limit?: number }) {
  const { q, categoryId, offset = 0, limit = 20 } = opts;
  const term = q.trim().slice(0, 80);
  if (!term && !categoryId) return { items: [] as FoodResult[], hasMore: false };

  const supabase = await createClient();
  const [foodRes, ownCustom, ownRecipes] = await Promise.all([
    supabase.rpc("search_foods", { p_query: term, p_category_id: categoryId ?? null, p_limit: limit + 1, p_offset: offset }),
    term && !categoryId && offset === 0 ? supabase.from("custom_foods").select("id").ilike("name", `%${escapeLike(term)}%`).limit(5) : Promise.resolve({ data: [], error: null }),
    term && !categoryId && offset === 0 ? supabase.from("recipes").select("id").ilike("name", `%${escapeLike(term)}%`).limit(5) : Promise.resolve({ data: [], error: null }),
  ]);
  if (foodRes.error) throw foodRes.error;
  if (ownCustom.error) throw ownCustom.error;
  if (ownRecipes.error) throw ownRecipes.error;

  const rows = (foodRes.data ?? []) as { id: number }[];
  const hasMore = rows.length > limit;
  const refs: FoodRef[] = [
    ...(ownCustom.data ?? []).map((r: { id: string }) => ({ kind: "custom" as const, id: r.id })),
    ...(ownRecipes.data ?? []).map((r: { id: string }) => ({ kind: "recipe" as const, id: r.id })),
    ...rows.slice(0, limit).map((r) => ({ kind: "food" as const, id: String(r.id) })),
  ];
  return { items: await withFavorites(await loadFoodRefs(refs)), hasMore };
}
