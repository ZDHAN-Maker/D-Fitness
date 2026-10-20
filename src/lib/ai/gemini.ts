/**
 * Minimal Gemini REST client (generateContent). No SDK, so behaviour is explicit and unit-testable.
 *
 * SECURITY: the API key is only ever sent in the `x-goog-api-key` header, never in a URL, a log line, an error
 * message or a response body. Raw provider error bodies are never shown to users (they are mapped to a `kind`).
 * This module takes the key as a parameter and reads no environment itself; only server code calls it.
 */

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export type GeminiRequest = {
  apiKey: string;
  baseUrl: string;
  model: string;
  system?: string;
  contents: GeminiContent[];
  /** Gemini responseSchema (OpenAPI subset). When set, the model must answer with JSON of this shape. */
  schema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type GeminiResult = { text: string; inputTokens: number; outputTokens: number; finishReason: string | null };

export type ProviderErrorKind = "auth" | "quota" | "model" | "bad_request" | "blocked" | "unavailable" | "empty" | "truncated" | "invalid_output";

export class AiProviderError extends Error {
  constructor(
    public readonly kind: ProviderErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

/** Remove anything that looks like a Google API key from a string before it can reach logs or users. */
export function redactSecrets(s: string): string {
  return s.replace(/AQ\.[A-Za-z0-9._-]{8,}/g, "[redacted]").replace(/AIza[A-Za-z0-9._-]{10,}/g, "[redacted]");
}

export function buildBody(req: GeminiRequest) {
  return {
    ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
    contents: req.contents,
    generationConfig: {
      temperature: req.temperature ?? 0.4,
      // Generous on purpose: reasoning tokens count toward this budget, and a truncated JSON answer is useless.
      maxOutputTokens: req.maxOutputTokens ?? 4096,
      ...(req.schema ? { responseMimeType: "application/json", responseSchema: req.schema } : {}),
    },
  };
}

type RawResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
};

export function parseResponse(json: RawResponse): GeminiResult {
  if (json.promptFeedback?.blockReason) throw new AiProviderError("blocked", "The request was blocked by the provider's safety filter.");
  const cand = json.candidates?.[0];
  const finish = cand?.finishReason ?? null;
  if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT" || finish === "BLOCKLIST") throw new AiProviderError("blocked", "The answer was blocked by the provider's safety filter.");
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!text) throw new AiProviderError("empty", "The model returned no text.");
  if (finish === "MAX_TOKENS") throw new AiProviderError("truncated", "The answer was cut off.");
  const u = json.usageMetadata ?? {};
  return { text, inputTokens: u.promptTokenCount ?? 0, outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0), finishReason: finish };
}

function kindForStatus(status: number): ProviderErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "quota";
  if (status === 404) return "model";
  if (status >= 500) return "unavailable";
  return "bad_request";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function geminiGenerate(req: GeminiRequest): Promise<GeminiResult> {
  const doFetch = req.fetchImpl ?? fetch;
  const url = `${req.baseUrl.replace(/\/$/, "")}/models/${encodeURIComponent(req.model)}:generateContent`;
  const body = JSON.stringify(buildBody(req));

  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), req.timeoutMs ?? 45_000);
    try {
      const res = await doFetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": req.apiKey }, body, signal: ctl.signal, cache: "no-store" });
      if (!res.ok) {
        const kind = kindForStatus(res.status);
        // Only transient server errors are retried (once). Auth / quota / model errors will not fix themselves.
        if (kind === "unavailable" && attempt === 1) {
          await sleep(700);
          continue;
        }
        let detail = "";
        try {
          detail = redactSecrets(String(((await res.json()) as { error?: { message?: string } })?.error?.message ?? "")).slice(0, 200);
        } catch {
          /* non-JSON error body */
        }
        throw new AiProviderError(kind, `Provider returned ${res.status}${detail ? `: ${detail}` : ""}`, res.status);
      }
      return parseResponse((await res.json()) as RawResponse);
    } catch (e) {
      if (e instanceof AiProviderError) throw e;
      const aborted = e instanceof Error && e.name === "AbortError";
      if (attempt === 1) {
        await sleep(700);
        continue;
      }
      throw new AiProviderError("unavailable", aborted ? "The provider timed out." : "Could not reach the provider.");
    } finally {
      clearTimeout(timer);
    }
  }
  throw new AiProviderError("unavailable", "The provider is unavailable.");
}

/** Free, token-less check that the key and base URL work: lists one model. */
export async function geminiCheck(p: { apiKey: string; baseUrl: string; fetchImpl?: typeof fetch }): Promise<void> {
  const doFetch = p.fetchImpl ?? fetch;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10_000);
  try {
    const res = await doFetch(`${p.baseUrl.replace(/\/$/, "")}/models?pageSize=1`, { headers: { "x-goog-api-key": p.apiKey }, signal: ctl.signal, cache: "no-store" });
    if (!res.ok) throw new AiProviderError(kindForStatus(res.status), `Provider returned ${res.status}`, res.status);
  } catch (e) {
    if (e instanceof AiProviderError) throw e;
    throw new AiProviderError("unavailable", "Could not reach the provider.");
  } finally {
    clearTimeout(timer);
  }
}

/** Parse the model's JSON answer (tolerating ```json fences). Never trusted: callers validate it with Zod. */
export function parseModelJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(t);
  } catch {
    throw new AiProviderError("invalid_output", "The model did not return valid JSON.");
  }
}
