import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { getAiConfig } from "@/lib/ai/config";
import { AiProviderError, geminiCheck } from "@/lib/ai/gemini";
import { getUsage } from "@/lib/ai/usage";

export const dynamic = "force-dynamic";

/** GET /api/ai/status — is AI set up, and how much of today's allowance is used. Never returns any secret. */
export async function GET() {
  try {
    await requireApiUser();
    const c = getAiConfig();
    const usage = await getUsage().catch(() => null);
    return jsonOk({ configured: c.configured, missing: c.missing, provider: c.provider, textModel: c.textModel, visionModel: c.visionModel, limits: { daily: c.dailyLimit, vision: c.visionDailyLimit }, usage });
  } catch (err) {
    return jsonError(err);
  }
}

const HINT: Record<string, string> = {
  auth: "The provider rejected the key. Check that AI_API_KEY is copied exactly, that the Gemini (Generative Language) API is enabled for the key's Google Cloud project, and that no key restriction blocks this server.",
  quota: "The key works, but its quota is used up or rate-limited right now.",
  model: "The key works, but a configured model name was not found.",
  bad_request: "The provider rejected the request. Check AI_BASE_URL.",
  unavailable: "Could not reach the provider. Try again in a moment.",
};

/** POST /api/ai/status — live, token-free check of the key (lists one model). Never echoes the key or the provider body. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiUser();
    const c = getAiConfig();
    if (!c.apiKey) return jsonOk({ ok: false, kind: "not_configured", message: `Missing: ${c.missing.join(", ")}.` });
    try {
      await geminiCheck({ apiKey: c.apiKey, baseUrl: c.baseUrl });
      return jsonOk({ ok: true, kind: "ok", message: c.configured ? "The AI provider accepted the key." : `The key works, but AI is still off. Missing: ${c.missing.join(", ")}.` });
    } catch (e) {
      const kind = e instanceof AiProviderError ? e.kind : "unavailable";
      return jsonOk({ ok: false, kind, message: HINT[kind] ?? HINT.unavailable });
    }
  } catch (err) {
    return jsonError(err);
  }
}
