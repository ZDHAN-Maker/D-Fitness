import { describe, expect, it } from "vitest";
import { checkInSchema, measurementSchema, photoMetaSchema, rangeSchema, waterSchema, weightSchema } from "./body";

const date = "2026-10-08";

describe("weightSchema", () => {
  it("accepts a normal weight and trims the note", () => {
    expect(weightSchema.parse({ date, weightKg: 75.4, note: " morning " }).note).toBe("morning");
  });
  it.each([[0], [-5], [10], [600], [Number.NaN]])("rejects %s kg", (w) => expect(weightSchema.safeParse({ date, weightKg: w }).success).toBe(false));
  it("rejects a bad date", () => expect(weightSchema.safeParse({ date: "yesterday", weightKg: 75 }).success).toBe(false));
});

describe("measurementSchema", () => {
  it("needs at least one value; blanks count as absent", () => {
    expect(measurementSchema.safeParse({ date }).success).toBe(false);
    expect(measurementSchema.safeParse({ date, waistCm: "", chestCm: Number.NaN }).success).toBe(false);
    expect(measurementSchema.safeParse({ date, waistCm: 82 }).success).toBe(true);
  });
  it("bounds each measurement", () => {
    expect(measurementSchema.safeParse({ date, waistCm: 5 }).success).toBe(false);
    expect(measurementSchema.safeParse({ date, bodyFatPct: 90 }).success).toBe(false);
    expect(measurementSchema.safeParse({ date, armCm: -3 }).success).toBe(false);
  });
});

describe("checkInSchema", () => {
  it("accepts sleep only, check-in only, or both", () => {
    expect(checkInSchema.safeParse({ date, sleep: { durationMinutes: 444, quality: 4 } }).success).toBe(true);
    expect(checkInSchema.safeParse({ date, recovery: { energy: 4, stress: 2 } }).success).toBe(true);
    expect(checkInSchema.safeParse({ date, sleep: { durationMinutes: 400 }, recovery: { soreness: 3 } }).success).toBe(true);
  });
  it("rejects an empty check-in", () => {
    expect(checkInSchema.safeParse({ date }).success).toBe(false);
    expect(checkInSchema.safeParse({ date, recovery: {} }).success).toBe(false);
    expect(checkInSchema.safeParse({ date, recovery: { energy: "" } }).success).toBe(false);
  });
  it.each([
    ["scale 0", { recovery: { energy: 0 } }],
    ["scale 6", { recovery: { stress: 6 } }],
    ["fractional scale", { recovery: { soreness: 2.5 } }],
    ["sleep 0 min", { sleep: { durationMinutes: 0 } }],
    ["sleep over 24h", { sleep: { durationMinutes: 1500 } }],
    ["sleep quality 9", { sleep: { durationMinutes: 400, quality: 9 } }],
  ])("rejects %s", (_n, body) => expect(checkInSchema.safeParse({ date, ...body }).success).toBe(false));
});

describe("waterSchema", () => {
  it.each([[250], [500], [750], [1000], [5000]])("accepts %i ml", (ml) => expect(waterSchema.safeParse({ date, amountMl: ml }).success).toBe(true));
  it.each([[0], [-250], [5001], [250.5], [Number.NaN]])("rejects %s ml", (ml) => expect(waterSchema.safeParse({ date, amountMl: ml }).success).toBe(false));
});

describe("photoMetaSchema", () => {
  const ok = { path: "u/11111111-1111-4111-8111-111111111111.jpg", takenOn: date, pose: "front", mimeType: "image/jpeg", sizeBytes: 250_000 };
  it("accepts a normal photo", () => expect(photoMetaSchema.safeParse(ok).success).toBe(true));
  it("rejects non-image types, oversized files and unknown poses", () => {
    expect(photoMetaSchema.safeParse({ ...ok, mimeType: "image/gif" }).success).toBe(false);
    expect(photoMetaSchema.safeParse({ ...ok, mimeType: "application/pdf" }).success).toBe(false);
    expect(photoMetaSchema.safeParse({ ...ok, sizeBytes: 9 * 1024 * 1024 }).success).toBe(false);
    expect(photoMetaSchema.safeParse({ ...ok, pose: "selfie" }).success).toBe(false);
  });
});

describe("rangeSchema", () => {
  it("defaults to 90 days and rejects unknown ranges", () => {
    expect(rangeSchema.parse({}).range).toBe("90d");
    expect(rangeSchema.safeParse({ range: "forever" }).success).toBe(false);
  });
});
