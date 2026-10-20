import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { getAiConfig } from "@/lib/ai/config";

export type AiFeature = "coach" | "insight" | "meal_assistant" | "workout_generator" | "weekly_review" | "food_scan";
export type Usage = { total: number; vision: number };

/** Pure: which limit (if any) blocks this feature right now? */
export function limitMessage(usage: Usage, feature: AiFeature, limits: { daily: number; vision: number }): string | null {
  if (feature === "food_scan" && usage.vision >= limits.vision) return `You've reached today's limit of ${limits.vision} food scans. It resets within 24 hours.`;
  if (usage.total >= limits.daily) return `You've reached today's limit of ${limits.daily} AI requests. It resets within 24 hours.`;
  return null;
}

/** Rolling 24 h usage for the signed-in user (RLS: users can only read their own log). */
export async function getUsage(): Promise<Usage> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data, error } = await supabase.from("ai_usage_logs").select("feature").gte("created_at", since).limit(2000);
  if (error) throw error;
  const rows = data ?? [];
  return { total: rows.length, vision: rows.filter((r) => r.feature === "food_scan").length };
}

export async function assertWithinLimits(feature: AiFeature) {
  const cfg = getAiConfig();
  const msg = limitMessage(await getUsage(), feature, { daily: cfg.dailyLimit, vision: cfg.visionDailyLimit });
  if (msg) throw new AppError("rate_limited", msg, 429);
}

/** Written with the service role so users cannot delete or forge their own usage. Failure is logged, never fatal. */
export async function recordUsage(userId: string, feature: AiFeature, model: string, inputTokens: number, outputTokens: number) {
  try {
    const { error } = await createAdminClient().from("ai_usage_logs").insert({ user_id: userId, feature, model, input_tokens: inputTokens, output_tokens: outputTokens });
    if (error) console.error("[ai-usage] insert failed", error.message);
  } catch (e) {
    console.error("[ai-usage] could not record usage", e instanceof Error ? e.message : e);
  }
}
