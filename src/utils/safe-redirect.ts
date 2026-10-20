/**
 * Only allow same-origin relative paths as post-login redirect targets
 * (prevents open-redirect attacks via ?next=https://evil.example).
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  try {
    const url = new URL(next, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
