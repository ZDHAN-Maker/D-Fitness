import "server-only";
import { getServerEnv, getServiceRoleKey } from "@/lib/env.server";

export const DEFAULT_MODEL = "gemini-3.8-flash";
export const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export type AiConfig = {
  configured: boolean;
  /** Names of the environment variables that still need to be set (never their values). */
  missing: string[];
  apiKey: string | null;
  provider: "gemini";
  textModel: string;
  visionModel: string;
  baseUrl: string;
  dailyLimit: number;
  visionDailyLimit: number;
};

/**
 * AI is "configured" only when BOTH a provider key and the service-role key exist. The service-role key is needed to
 * write usage logs that users cannot tamper with; without it daily limits could not be enforced, so AI stays OFF
 * (fail closed) rather than running without a cost guard.
 */
export function getAiConfig(): AiConfig {
  const env = getServerEnv();
  const missing: string[] = [];
  if (env.AI_PROVIDER && env.AI_PROVIDER.toLowerCase() !== "gemini") missing.push("AI_PROVIDER (only \"gemini\" is supported)");
  if (!env.AI_API_KEY) missing.push("AI_API_KEY");
  if (!getServiceRoleKey()) missing.push("SUPABASE_SECRET_KEY");
  const textModel = env.AI_MODEL_TEXT || DEFAULT_MODEL;
  return {
    configured: missing.length === 0,
    missing,
    apiKey: env.AI_API_KEY ?? null,
    provider: "gemini",
    textModel,
    visionModel: env.AI_MODEL_VISION || textModel,
    baseUrl: env.AI_BASE_URL || DEFAULT_BASE_URL,
    dailyLimit: env.AI_DAILY_LIMIT ?? 40,
    visionDailyLimit: env.AI_DAILY_VISION_LIMIT ?? 10,
  };
}

/** Same as getAiConfig(), but a malformed AI_* variable shows up as "not configured" instead of crashing the page. */
export function tryGetAiConfig(): AiConfig {
  try {
    return getAiConfig();
  } catch {
    return { configured: false, missing: ["a valid AI_* environment variable (check AI_BASE_URL and the AI_DAILY_* limits)"], apiKey: null, provider: "gemini", textModel: DEFAULT_MODEL, visionModel: DEFAULT_MODEL, baseUrl: DEFAULT_BASE_URL, dailyLimit: 40, visionDailyLimit: 10 };
  }
}
