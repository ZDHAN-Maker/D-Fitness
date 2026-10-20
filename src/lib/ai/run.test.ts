import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { AiProviderError } from "./gemini";

const SECRET = "AQ.SuperSecretKeyValue1234567890";
const cfg = { configured: true, missing: [] as string[], apiKey: SECRET, provider: "gemini", textModel: "text-model", visionModel: "vision-model", baseUrl: "https://example.test/v1beta", dailyLimit: 40, visionDailyLimit: 10 };

const state = vi.hoisted(() => ({ cfg: null as unknown, generate: vi.fn(), assertLimits: vi.fn(), record: vi.fn() }));
vi.mock("@/lib/ai/config", () => ({ getAiConfig: () => state.cfg }));
vi.mock("@/lib/ai/usage", () => ({ assertWithinLimits: state.assertLimits, recordUsage: state.record }));
vi.mock("@/lib/ai/gemini", async (orig) => ({ ...(await orig<typeof import("./gemini")>()), geminiGenerate: state.generate }));

import { runAi, toAppError } from "./run";

const base = { userId: "u1", feature: "coach" as const, system: "sys", contents: [{ role: "user" as const, parts: [{ text: "q" }] }], schema: { type: "OBJECT" } };
const validate = (raw: unknown) => z.object({ answer: z.string().min(1) }).parse(raw);
const reply = (text: string, i = 100, o = 20) => ({ text, inputTokens: i, outputTokens: o, finishReason: "STOP" });

beforeEach(() => {
  state.cfg = { ...cfg };
  state.generate.mockReset();
  state.assertLimits.mockReset().mockResolvedValue(undefined);
  state.record.mockReset().mockResolvedValue(undefined);
});

describe("runAi", () => {
  it("returns validated data and records the token usage", async () => {
    state.generate.mockResolvedValue(reply('{"answer":"Hello"}'));
    const r = await runAi({ ...base, validate });
    expect(r).toEqual({ data: { answer: "Hello" }, model: "text-model" });
    expect(state.generate).toHaveBeenCalledWith(expect.objectContaining({ apiKey: SECRET, model: "text-model", schema: base.schema }));
    expect(state.record).toHaveBeenCalledWith("u1", "coach", "text-model", 100, 20);
  });

  it("uses the vision model for vision requests", async () => {
    state.generate.mockResolvedValue(reply('{"answer":"x"}'));
    expect((await runAi({ ...base, feature: "food_scan", vision: true, validate })).model).toBe("vision-model");
  });

  it("does not call the provider (and records nothing) when AI is not configured, naming what is missing", async () => {
    state.cfg = { ...cfg, configured: false, missing: ["AI_API_KEY", "SUPABASE_SECRET_KEY"], apiKey: null };
    const err = await runAi({ ...base, validate }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("unavailable");
    expect(err.message).toContain("AI_API_KEY");
    expect(state.generate).not.toHaveBeenCalled();
    expect(state.record).not.toHaveBeenCalled();
  });

  it("stops before the provider call when the daily limit is reached", async () => {
    state.assertLimits.mockRejectedValue(new AppError("rate_limited", "limit", 429));
    await expect(runAi({ ...base, validate })).rejects.toMatchObject({ code: "rate_limited" });
    expect(state.generate).not.toHaveBeenCalled();
    expect(state.record).not.toHaveBeenCalled();
  });

  it("retries ONCE when the first answer is not valid JSON, and sums the tokens of both calls", async () => {
    state.generate.mockResolvedValueOnce(reply("Sure, here it is!", 100, 10)).mockResolvedValueOnce(reply('{"answer":"ok"}', 120, 30));
    const r = await runAi({ ...base, validate });
    expect(r.data).toEqual({ answer: "ok" });
    expect(state.generate).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(state.generate.mock.calls[1]?.[0].contents)).toContain("not valid for the schema");
    expect(state.record).toHaveBeenCalledTimes(1);
    expect(state.record).toHaveBeenCalledWith("u1", "coach", "text-model", 220, 40);
  });

  it("retries once when the JSON fails validation, then gives a friendly error without a third call", async () => {
    state.generate.mockResolvedValue(reply('{"answer":""}'));
    const err = await runAi({ ...base, validate }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("unavailable");
    expect(state.generate).toHaveBeenCalledTimes(2);
    expect(state.record).toHaveBeenCalledTimes(1); // failures still count toward the daily limit
  });

  it("does not retry provider failures, and the error never exposes the key or provider text", async () => {
    state.generate.mockRejectedValue(new AiProviderError("auth", `Provider returned 401: key ${SECRET} invalid`, 401));
    const err = await runAi({ ...base, validate }).catch((e) => e);
    expect(state.generate).toHaveBeenCalledTimes(1);
    expect(err.message).not.toContain("SuperSecret");
    expect(err.message).not.toContain("Provider returned");
    expect(err.message).toMatch(/API key/);
    expect(state.record).toHaveBeenCalledWith("u1", "coach", "text-model", 0, 0);
  });
});

describe("toAppError", () => {
  it.each([
    ["quota", "rate_limited", 429],
    ["model", "unavailable", 503],
    ["blocked", "validation", 422],
    ["unavailable", "unavailable", 503],
    ["truncated", "unavailable", 503],
    ["empty", "unavailable", 503],
  ] as const)("maps %s -> %s", (kind, code, status) => {
    const e = toAppError(new AiProviderError(kind, "internal detail"));
    expect(e).toMatchObject({ code, status });
    expect(e.message).not.toContain("internal detail");
  });
  it("hides unexpected errors behind a generic message", () => {
    const e = toAppError(new Error(`boom with ${SECRET}`));
    expect(e.code).toBe("unknown");
    expect(e.message).not.toContain("boom");
  });
});
