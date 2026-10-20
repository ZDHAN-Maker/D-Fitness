import { describe, expect, it } from "vitest";
import { customFoodSchema, isoDate, logFoodSchema, recipeSchema, searchQuerySchema, updateLogItemSchema } from "./nutrition";

const ref = { kind: "food", id: "1" } as const;
const portion = { quantity: 200, unitCode: "g" };

describe("logFoodSchema", () => {
  it("accepts a valid entry", () => {
    expect(logFoodSchema.safeParse({ date: "2026-10-08", mealType: "lunch", ref, portion }).success).toBe(true);
  });
  it.each([
    ["zero amount", { ...portion, quantity: 0 }],
    ["negative amount", { ...portion, quantity: -1 }],
    ["absurd amount", { ...portion, quantity: 1e9 }],
    ["missing unit", { quantity: 1, unitCode: "" }],
  ])("rejects %s", (_n, p) => {
    expect(logFoodSchema.safeParse({ date: "2026-10-08", mealType: "lunch", ref, portion: p }).success).toBe(false);
  });
  it("rejects an unknown meal type", () => {
    expect(logFoodSchema.safeParse({ date: "2026-10-08", mealType: "brunch", ref, portion }).success).toBe(false);
  });
  it("ignores client-sent nutrition (strips unknown keys)", () => {
    const r = logFoodSchema.parse({ date: "2026-10-08", mealType: "lunch", ref, portion, calories: 1 });
    expect("calories" in r).toBe(false);
  });
});

describe("isoDate", () => {
  it("rejects impossible and far-future dates", () => {
    expect(isoDate.safeParse("2026-13-40").success).toBe(false);
    expect(isoDate.safeParse("2099-01-01").success).toBe(false);
    expect(isoDate.safeParse("1999-12-31").success).toBe(false);
    expect(isoDate.safeParse("not-a-date").success).toBe(false);
  });
});

describe("updateLogItemSchema", () => {
  it("requires something to change", () => {
    expect(updateLogItemSchema.safeParse({ itemId: "7f1c0a52-4d57-4c0a-9e0b-0c6f6f5d9a11" }).success).toBe(false);
    expect(updateLogItemSchema.safeParse({ itemId: "7f1c0a52-4d57-4c0a-9e0b-0c6f6f5d9a11", mealType: "dinner" }).success).toBe(true);
  });
});

describe("customFoodSchema", () => {
  const manual = { baseQuantity: 100, baseUnit: "g", calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, fiber_g: 0.4 };
  it("manual mode needs nutrition values", () => {
    expect(customFoodSchema.safeParse({ name: "x", mode: "manual" }).success).toBe(false);
    expect(customFoodSchema.safeParse({ name: "x", mode: "manual", manual }).success).toBe(true);
  });
  it("rejects negative macros", () => {
    expect(customFoodSchema.safeParse({ name: "x", mode: "manual", manual: { ...manual, protein_g: -1 } }).success).toBe(false);
  });
  it("ingredient mode needs at least one ingredient, food only", () => {
    expect(customFoodSchema.safeParse({ name: "x", mode: "ingredients", ingredients: [] }).success).toBe(false);
    expect(customFoodSchema.safeParse({ name: "x", mode: "ingredients", ingredients: [{ kind: "food", id: "1", portion }] }).success).toBe(true);
    expect(customFoodSchema.safeParse({ name: "x", mode: "ingredients", ingredients: [{ kind: "custom", id: "1", portion }] }).success).toBe(false);
  });
  it("treats blank optional text as absent", () => {
    expect(customFoodSchema.parse({ name: "x", brand: "  ", mode: "manual", manual }).brand).toBeUndefined();
  });
});

describe("recipeSchema", () => {
  it("requires servings > 0 and ingredients", () => {
    const ing = [{ kind: "food", id: "1", portion }];
    expect(recipeSchema.safeParse({ name: "r", servings: 0, ingredients: ing }).success).toBe(false);
    expect(recipeSchema.safeParse({ name: "r", servings: 2, ingredients: [] }).success).toBe(false);
    expect(recipeSchema.safeParse({ name: "r", servings: 2, ingredients: ing }).success).toBe(true);
  });
});

describe("searchQuerySchema", () => {
  it("applies defaults and caps page size", () => {
    expect(searchQuerySchema.parse({})).toMatchObject({ q: "", offset: 0, limit: 20 });
    expect(searchQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: "x".repeat(200) }).success).toBe(false);
  });
});
