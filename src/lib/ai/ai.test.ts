import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiProviderError, buildBody, geminiCheck, geminiGenerate, parseModelJson, parseResponse, redactSecrets } from "./gemini";
import { CALORIE_FLOOR, CANNED, classifyMessage, clampText, violatesCalorieFloor } from "./safety";
import { coachZod, mealZod, reviewZod, scanZod, workoutZod } from "./schemas";
import { estimateMinutes, normalizeScan, validateMeals, validateWorkout, type CandidateExercise, type CandidateFood } from "./validate";
import { limitMessage } from "./usage";
import type { NutritionPer } from "@/lib/calculations/nutrition";

const KEY = "AQ.TestKeyDoNotUse-1234567890abcdef";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ok = (text: string, extra = {}) => json({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 40, thoughtsTokenCount: 10 }, ...extra });

describe("gemini request", () => {
  const base = { apiKey: KEY, baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-3.8-flash", contents: [{ role: "user" as const, parts: [{ text: "hi" }] }] };

  it("sends the key ONLY in the x-goog-api-key header (never in the URL or body)", async () => {
    const f = vi.fn().mockResolvedValue(ok('{"a":1}'));
    await geminiGenerate({ ...base, fetchImpl: f as unknown as typeof fetch });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    expect(url).not.toContain(KEY);
    expect(String(init.body)).not.toContain(KEY);
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
    expect(init.method).toBe("POST");
  });
  it("asks for JSON of a schema, with a generous token budget and a system prompt", () => {
    const b = buildBody({ ...base, system: "rules", schema: { type: "OBJECT" }, maxOutputTokens: 3000 });
    expect(b.systemInstruction?.parts[0]?.text).toBe("rules");
    expect(b.generationConfig).toMatchObject({ responseMimeType: "application/json", responseSchema: { type: "OBJECT" }, maxOutputTokens: 3000 });
    expect(buildBody(base).generationConfig).not.toHaveProperty("responseMimeType");
  });
  it("supports image input as inline data", () => {
    const b = buildBody({ ...base, contents: [{ role: "user", parts: [{ text: "what is this" }, { inline_data: { mime_type: "image/jpeg", data: "AAAA" } }] }] });
    expect(JSON.stringify(b.contents)).toContain("inline_data");
  });
  it("returns text and token usage (reasoning tokens count as output)", async () => {
    const r = await geminiGenerate({ ...base, fetchImpl: (async () => ok('{"x":1}')) as unknown as typeof fetch });
    expect(r).toMatchObject({ text: '{"x":1}', inputTokens: 100, outputTokens: 50, finishReason: "STOP" });
  });
});

describe("gemini errors", () => {
  const base = { apiKey: KEY, baseUrl: "https://example.test/v1beta", model: "m", contents: [{ role: "user" as const, parts: [{ text: "hi" }] }] };
  const fails = (status: number, message = "nope") => vi.fn().mockImplementation(async () => json({ error: { message } }, status));
  const run = (f: ReturnType<typeof vi.fn>) => geminiGenerate({ ...base, fetchImpl: f as unknown as typeof fetch });

  it.each([[401, "auth"], [403, "auth"], [429, "quota"], [404, "model"], [400, "bad_request"]] as const)("maps HTTP %i to %s without retrying", async (status, kind) => {
    const f = fails(status);
    await expect(run(f)).rejects.toMatchObject({ kind, status });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("retries a transient 503 once, then succeeds", async () => {
    const f = vi.fn().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(ok("{}"));
    await expect(run(f)).resolves.toMatchObject({ text: "{}" });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("gives up after one retry on persistent 5xx and on network errors", async () => {
    await expect(run(fails(500))).rejects.toMatchObject({ kind: "unavailable" });
    const net = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(run(net)).rejects.toMatchObject({ kind: "unavailable" });
    expect(net).toHaveBeenCalledTimes(2);
  });
  it("never leaks a key that the provider echoes back in an error message", async () => {
    const err = await run(fails(401, `API key ${KEY} is invalid`)).catch((e: AiProviderError) => e);
    expect((err as Error).message).not.toContain("TestKeyDoNotUse");
    expect(redactSecrets(`x AIzaSyA1234567890abcdefgh y ${KEY}`)).toBe("x [redacted] y [redacted]");
  });
  it("detects blocked, empty and truncated answers", () => {
    expect(() => parseResponse({ promptFeedback: { blockReason: "SAFETY" } })).toThrow(/blocked/i);
    expect(() => parseResponse({ candidates: [{ finishReason: "SAFETY" }] })).toThrow(AiProviderError);
    expect(() => parseResponse({ candidates: [{ content: { parts: [{ text: "" }] }, finishReason: "STOP" }] })).toThrow(/no text/i);
    expect(() => parseResponse({ candidates: [{ content: { parts: [{ text: '{"a":' }] }, finishReason: "MAX_TOKENS" }] })).toThrow(/cut off/i);
  });
  it("status check lists models with the header and reports auth failures", async () => {
    const good = vi.fn().mockResolvedValue(json({ models: [] }));
    await geminiCheck({ apiKey: KEY, baseUrl: "https://example.test/v1beta", fetchImpl: good as unknown as typeof fetch });
    expect(String(good.mock.calls[0]?.[0])).toBe("https://example.test/v1beta/models?pageSize=1");
    await expect(geminiCheck({ apiKey: KEY, baseUrl: "https://example.test/v1beta", fetchImpl: fails(401) as unknown as typeof fetch })).rejects.toMatchObject({ kind: "auth" });
  });
});

describe("parseModelJson", () => {
  it("accepts plain and fenced JSON and rejects prose", () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseModelJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(() => parseModelJson("Sure! Here you go")).toThrow(/valid JSON/);
  });
});

describe("message safety screen (runs BEFORE any model call)", () => {
  it.each([
    ["I have chest pain when I run", "emergency"],
    ["I fainted during squats", "emergency"],
    ["I want to kill myself", "emergency"],
    ["nyeri dada saat lari", "emergency"],
    ["how do I make myself throw up after meals", "eating_disorder"],
    ["I've stopped eating to lose weight", "eating_disorder"],
    ["which laxatives burn fat", "eating_disorder"],
    ["I will eat 600 calories a day", "extreme_restriction"],
    ["plan a diet of 900 kcal", "extreme_restriction"],
    ["only 500 calories a day please", "extreme_restriction"],
    ["makan 700 kalori sehari", "extreme_restriction"],
    ["is an 800 calorie diet ok", "extreme_restriction"],
    ["a 500 calorie deficit per day is fine for me", "ok"],
    ["dinner under 600 calories please", "ok"],
    ["what should I eat for 500 calories", "ok"],
    ["I burn 2500 calories a day", "ok"],
    ["help me lose 10 kg in a week", "extreme_restriction"],
    ["turun 5 kg dalam seminggu", "extreme_restriction"],
    ["can you diagnose my knee injury", "medical"],
    ["what dosage of creatine", "medical"],
    ["am I eating enough protein?", "ok"],
    ["should I train legs today", "ok"],
    ["I want to eat 2000 calories to gain muscle", "ok"],
    ["lose 0.5 kg per week", "ok"],
  ] as const)("%s -> %s", (msg, cls) => expect(classifyMessage(msg)).toBe(cls));

  it("has careful canned replies for each blocked class", () => {
    expect(CANNED.emergency).toMatch(/emergency number/i);
    expect(CANNED.eating_disorder).toMatch(/dietitian|doctor/i);
    expect(CANNED.extreme_restriction).toContain(String(CALORIE_FLOOR));
  });
  it("blocks model output that recommends an intake below the floor, but not normal numbers", () => {
    expect(violatesCalorieFloor("You should aim for 900 calories a day")).toBe(true);
    expect(violatesCalorieFloor("Eat no more than 1000 kcal")).toBe(true);
    expect(violatesCalorieFloor("Aim for 2200 kcal and 150 g protein")).toBe(false);
    expect(violatesCalorieFloor("That meal is 450 kcal")).toBe(false);
  });
  it("clamps long text", () => expect(clampText("x".repeat(50), 10)).toHaveLength(10));
});

describe("output schemas (the model is never trusted)", () => {
  it("coach: defaults for optional lists and bounds on length", () => {
    expect(coachZod.parse({ answer: " Hi " })).toEqual({ answer: "Hi", recommendations: [], missing_data: [], needs_professional: false });
    expect(coachZod.safeParse({ answer: "" }).success).toBe(false);
    expect(coachZod.safeParse({ answer: "x", recommendations: Array(9).fill("a") }).success).toBe(false);
  });
  it("tolerates nulls the model likes to send for optional fields", () => {
    expect(mealZod.parse({ options: [{ title: "t", rationale: "", items: [{ food_id: 1, amount: 100 }] }], note: null }).note).toBe("");
    const w = workoutZod.parse({ title: "t", exercises: [{ exercise_id: 1, sets: 3, reps_min: null, duration_sec: null, note: null }] });
    expect(w.exercises[0]).toMatchObject({ reps_min: null, duration_sec: null, note: "" });
    expect(scanZod.parse({ is_food: true, notes: null, items: [] }).notes).toBe("");
  });
  it("rejects structurally wrong answers", () => {
    expect(mealZod.safeParse({ options: [] }).success).toBe(false);
    expect(mealZod.safeParse({ options: [{ title: "t", items: [{ food_id: "x", amount: 1 }] }] }).success).toBe(false);
    expect(workoutZod.safeParse({ title: "t", exercises: [] }).success).toBe(false);
    expect(reviewZod.parse({}).went_well).toEqual([]);
  });
});

const per = (kcal: number, p: number, c: number, f: number, unit: "g" | "ml" = "g"): NutritionPer => ({ base_quantity: 100, base_unit: unit, calories: kcal, protein_g: p, carbs_g: c, fat_g: f, fiber_g: 0 });
const foods = new Map<number, CandidateFood>([
  [1, { id: 1, name: "Chicken breast", per: per(165, 31, 0, 3.6) }],
  [2, { id: 2, name: "Nasi putih", per: per(130, 2.7, 28.2, 0.3) }],
  [3, { id: 3, name: "Susu", per: per(61, 3.2, 4.8, 3.3, "ml") }],
]);
const remaining = { calories: 620, protein_g: 38, carbs_g: 71, fat_g: 18, fiber_g: 5 };
const meal = (items: { food_id: number; amount: number }[], title = "Dinner") => ({ title, rationale: "r", items });

describe("validateMeals", () => {
  it("recomputes nutrition itself and ignores anything the model claims", () => {
    const { options } = validateMeals({ options: [meal([{ food_id: 1, amount: 150 }, { food_id: 2, amount: 200 }])], note: "" }, foods, remaining);
    expect(options).toHaveLength(1);
    const o = options[0]!;
    expect(o.totals.calories).toBe(507.5); // 247.5 + 260
    expect(o.totals.protein_g).toBe(51.9);
    expect(o.items[0]).toMatchObject({ name: "Chicken breast", unit: "g" });
    expect(o.proteinShare).toBe(1.37);
  });
  it("drops invented ids, duplicates and out-of-range amounts", () => {
    const { options, dropped } = validateMeals({ options: [meal([{ food_id: 999, amount: 100 }, { food_id: 1, amount: 150 }, { food_id: 1, amount: 100 }, { food_id: 2, amount: 5000 }, { food_id: 2, amount: 1 }])], note: "" }, foods, remaining);
    expect(options[0]?.items.map((i) => i.foodId)).toEqual([1]);
    expect(dropped).toBe(4);
  });
  it("drops options with no valid items, far too many calories, or too few", () => {
    const raw = { options: [meal([{ food_id: 999, amount: 100 }]), meal([{ food_id: 2, amount: 900 }]), meal([{ food_id: 3, amount: 10 }]), meal([{ food_id: 1, amount: 100 }], "Good")], note: "" };
    const { options } = validateMeals(raw, foods, remaining);
    expect(options.map((o) => o.title)).toEqual(["Good"]);
  });
  it("uses ml for liquids and caps the number of options", () => {
    const many = { options: Array.from({ length: 5 }, (_, i) => meal([{ food_id: 1, amount: 100 + i }], `o${i}`)), note: "" };
    expect(validateMeals(many, foods, remaining).options).toHaveLength(3);
    expect(validateMeals({ options: [meal([{ food_id: 3, amount: 250 }, { food_id: 1, amount: 100 }])], note: "" }, foods, remaining).options[0]?.items[0]?.unit).toBe("ml");
  });
});

const ex = (id: number, name: string, mode: CandidateExercise["tracking_mode"] = "weight_reps"): [number, CandidateExercise] => [id, { id, name, tracking_mode: mode, primary_muscle: "legs", equipment: "barbell" }];
const exercises = new Map<number, CandidateExercise>([ex(1, "Squat"), ex(2, "Bench Press"), ex(3, "Lat Pulldown"), ex(4, "Shoulder Press"), ex(5, "Plank", "duration"), ex(6, "Row"), ex(7, "Curl"), ex(8, "Lunge")]);
const w = (list: Partial<{ exercise_id: number; sets: number; reps_min: number | null; reps_max: number | null; duration_sec: number | null; rest_seconds: number | null }>[]) => ({
  title: "Full body",
  rationale: "r",
  exercises: list.map((e) => ({ exercise_id: 1, sets: 3, reps_min: 8, reps_max: 10, duration_sec: null, rest_seconds: 60, note: "", ...e })),
});

describe("validateWorkout", () => {
  it("accepts the 30-minute full-body example and estimates its length", () => {
    const v = validateWorkout(w([{ exercise_id: 1 }, { exercise_id: 2 }, { exercise_id: 3, reps_max: 12 }, { exercise_id: 4 }, { exercise_id: 5, sets: 3, reps_min: null, reps_max: null, duration_sec: 45 }]), exercises, { minutes: 30, recoveryLow: false });
    expect(v.exercises.map((e) => e.name)).toEqual(["Squat", "Bench Press", "Lat Pulldown", "Shoulder Press", "Plank"]);
    expect(v.exercises[4]).toMatchObject({ durationSec: 45, repsMin: null });
    expect(v.estimatedMinutes).toBeLessThanOrEqual(32);
    expect(v.trimmed).toBe(false);
  });
  it("ignores invented and duplicate exercises", () => {
    const v = validateWorkout(w([{ exercise_id: 1 }, { exercise_id: 999 }, { exercise_id: 1 }, { exercise_id: 2 }]), exercises, { minutes: 45, recoveryLow: false });
    expect(v.exercises.map((e) => e.exerciseId)).toEqual([1, 2]);
  });
  it("trims from the end so the session fits the time available", () => {
    const long = Array.from({ length: 8 }, (_, i) => ({ exercise_id: i + 1, sets: 5, rest_seconds: 120 }));
    const v = validateWorkout(w(long), exercises, { minutes: 20, recoveryLow: false });
    expect(v.trimmed).toBe(true);
    expect(v.estimatedMinutes).toBeLessThanOrEqual(22);
    expect(v.exercises.length).toBeGreaterThanOrEqual(2);
    expect(v.exercises[0]?.exerciseId).toBe(1); // earliest (most important) exercises are kept
  });
  it("reduces sets when even the minimum number of exercises would overrun", () => {
    const v = validateWorkout(w([{ exercise_id: 1, sets: 6, rest_seconds: 240 }, { exercise_id: 2, sets: 6, rest_seconds: 240 }]), exercises, { minutes: 15, recoveryLow: false });
    expect(v.estimatedMinutes).toBeLessThanOrEqual(17);
    expect(v.exercises.every((e) => e.sets >= 2)).toBe(true);
    expect(v.trimmed).toBe(true);
  });
  it("caps volume when recovery is low", () => {
    const v = validateWorkout(w([{ exercise_id: 1, sets: 6 }, { exercise_id: 2, sets: 5 }]), exercises, { minutes: 60, recoveryLow: true });
    expect(v.exercises.every((e) => e.sets <= 3)).toBe(true);
    expect(v.recoveryCapped).toBe(true);
  });
  it("clamps silly values and fills sensible defaults", () => {
    const v = validateWorkout(w([{ exercise_id: 1, sets: 50, reps_min: 900, reps_max: 1, rest_seconds: 5000 }, { exercise_id: 5, reps_min: null, reps_max: null, duration_sec: null, rest_seconds: null }]), exercises, { minutes: 90, recoveryLow: false });
    expect(v.exercises[0]).toMatchObject({ sets: 6, repsMin: 50, restSeconds: 240 });
    expect(v.exercises[0]!.repsMax).toBeGreaterThanOrEqual(50);
    expect(v.exercises[1]).toMatchObject({ durationSec: 45, restSeconds: 60 });
  });
  it("throws when fewer than two usable exercises remain", () => {
    expect(() => validateWorkout(w([{ exercise_id: 999 }, { exercise_id: 1 }]), exercises, { minutes: 30, recoveryLow: false })).toThrow(AiProviderError);
  });
  it("time estimate grows with sets and rest", () => {
    const a = validateWorkout(w([{ exercise_id: 1, sets: 3 }, { exercise_id: 2, sets: 3 }]), exercises, { minutes: 90, recoveryLow: false }).exercises;
    expect(estimateMinutes(a.map((e) => ({ ...e, sets: 6 })))).toBeGreaterThan(estimateMinutes(a));
  });
});

describe("normalizeScan", () => {
  const item = (o = {}) => ({ name: "White rice", search_terms: ["nasi putih", "rice"], estimated_grams: 180, confidence: 0.8, preparation: "", ...o });
  it("keeps the detected name first, de-duplicates and bounds search terms", () => {
    const r = normalizeScan({ is_food: true, notes: "", items: [item({ search_terms: ["Nasi putih", "white rice", "RICE", "x", "y", "z"] })] });
    expect(r.items[0]?.searchTerms).toEqual(["white rice", "nasi putih", "rice", "x"]);
  });
  it("clamps grams and confidence and drops unusable items", () => {
    const r = normalizeScan({ is_food: true, notes: "", items: [item({ estimated_grams: 99999, confidence: 7 }), item({ estimated_grams: 0 }), item({ estimated_grams: Number.NaN }), item({ estimated_grams: 1, confidence: -1, name: "Tiny" })] });
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ estimatedGrams: 1500, confidence: 1 });
    expect(r.items[1]).toMatchObject({ estimatedGrams: 5, confidence: 0 });
  });
  it("reports a non-food photo and caps the item count", () => {
    expect(normalizeScan({ is_food: false, notes: "A cat", items: [item()] })).toEqual({ isFood: false, notes: "A cat", items: [] });
    expect(normalizeScan({ is_food: true, notes: "", items: Array.from({ length: 14 }, (_, i) => item({ name: `f${i}` })) }).items).toHaveLength(8);
    expect(normalizeScan({ is_food: true, notes: "", items: [] }).isFood).toBe(false);
  });
});

describe("daily limits", () => {
  const limits = { daily: 40, vision: 10 };
  it("allows use under the limits", () => expect(limitMessage({ total: 5, vision: 1 }, "coach", limits)).toBeNull());
  it("blocks at the overall limit and at the stricter vision limit", () => {
    expect(limitMessage({ total: 40, vision: 0 }, "coach", limits)).toMatch(/40 AI requests/);
    expect(limitMessage({ total: 12, vision: 10 }, "food_scan", limits)).toMatch(/10 food scans/);
    expect(limitMessage({ total: 12, vision: 10 }, "coach", limits)).toBeNull(); // vision cap does not block text features
  });
});

beforeEach(() => vi.restoreAllMocks());
