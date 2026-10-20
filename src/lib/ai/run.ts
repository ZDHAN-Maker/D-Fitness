import "server-only";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { getAiConfig } from "@/lib/ai/config";
import { AiProviderError, geminiGenerate, parseModelJson, redactSecrets, type GeminiContent } from "@/lib/ai/gemini";
import { assertWithinLimits, recordUsage, type AiFeature } from "@/lib/ai/usage";

/** User-safe description of a provider failure. Nothing from the provider's response body is exposed. */
export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (e instanceof AiProviderError) {
    switch (e.kind) {
      case "auth":
        return new AppError("unavailable", "The AI provider rejected the API key. Open the AI status check on the Coach page for details.", 503);
      case "quota":
        return new AppError("rate_limited", "The AI provider's quota is used up. Please try again later.", 429);
      case "model":
        return new AppError("unavailable", "The configured AI model was not found. Check AI_MODEL_TEXT / AI_MODEL_VISION.", 503);
      case "blocked":
        return new AppError("validation", "The AI could not answer that request. Try rephrasing it.", 422);
      case "bad_request":
        return new AppError("unavailable", "The AI request was rejected by the provider.", 502);
      default:
        return new AppError("unavailable", "The AI is busy or returned an unusable answer. Please try again.", 503);
    }
  }
  console.error("[ai] unexpected error", redactSecrets(e instanceof Error ? e.message : String(e)));
  return new AppError("unknown", "Something went wrong with the AI request. Please try again.", 500);
}

export type RunOptions<T> = {
  userId: string;
  feature: AiFeature;
  vision?: boolean;
  system: string;
  contents: GeminiContent[];
  schema: Record<string, unknown>;
  /** Validates the parsed JSON (throws ZodError / AiProviderError("invalid_output") when unusable). */
  validate: (raw: unknown) => T;
  temperature?: number;
  maxOutputTokens?: number;
};

/**
 * The single path every AI feature goes through:
 *   configured? -> within today's limit? -> call Gemini -> parse JSON -> validate (one retry on unusable output)
 *   -> record token usage -> return validated data.
 * Usage is recorded even when the call fails after reaching the provider, so errors cannot be used to dodge limits.
 */
export async function runAi<T>(o: RunOptions<T>): Promise<{ data: T; model: string }> {
  const cfg = getAiConfig();
  if (!cfg.configured || !cfg.apiKey) {
    throw new AppError("unavailable", `AI features are not set up yet. The server needs: ${cfg.missing.join(", ")}.`, 503);
  }
  await assertWithinLimits(o.feature);

  const model = o.vision ? cfg.visionModel : cfg.textModel;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const contents: GeminiContent[] =
        attempt === 1 ? o.contents : [...o.contents, { role: "user", parts: [{ text: "Your previous reply was not valid for the schema. Reply again with ONLY the JSON object, using only ids and fields that were provided." }] }];
      const res = await geminiGenerate({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model, system: o.system, contents, schema: o.schema, temperature: o.temperature, maxOutputTokens: o.maxOutputTokens });
      inputTokens += res.inputTokens;
      outputTokens += res.outputTokens;
      try {
        return { data: o.validate(parseModelJson(res.text)), model };
      } catch (e) {
        const retryable = e instanceof ZodError || (e instanceof AiProviderError && e.kind === "invalid_output");
        if (!retryable || attempt === 2) throw e instanceof ZodError ? new AiProviderError("invalid_output", "The model's answer did not match the expected format.") : e;
      }
    }
    throw new AiProviderError("invalid_output", "No usable answer.");
  } catch (e) {
    throw toAppError(e);
  } finally {
    await recordUsage(o.userId, o.feature, model, inputTokens, outputTokens);
  }
}
