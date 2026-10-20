export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** POST JSON to an /api/ai/* route and unwrap the { data } / { error } envelope. Never throws. */
export async function postAi<T>(path: string, body: unknown): Promise<AiResult<T>> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null;
    if (!res.ok || !json || json.data === undefined) return { ok: false, error: json?.error?.message ?? "Something went wrong. Please try again." };
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }
}
