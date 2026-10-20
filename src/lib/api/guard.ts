import { AppError, unauthenticated } from "@/lib/errors";
import { getCurrentUser } from "@/lib/auth/session";

/** Route Handlers: 401 for anonymous callers. */
export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  return user;
}

/**
 * CSRF defence for cookie-authenticated mutations: the Origin header must match this host.
 * (SameSite=Lax cookies already block most cross-site POSTs; this closes the rest.)
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    throw new AppError("forbidden", "Request origin not allowed.", 403);
  }
}
