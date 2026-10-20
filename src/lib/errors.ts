import { ZodError } from "zod";

/** Result type returned by every Server Action. Never throw raw errors across the client boundary. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export type ErrorCode = "validation" | "unauthenticated" | "forbidden" | "not_found" | "conflict" | "rate_limited" | "unavailable" | "unknown";

/** An error whose message is safe to show to the user. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthenticated = () => new AppError("unauthenticated", "Please sign in to continue.", 401);

const GENERIC = "Something went wrong. Please try again.";

type PostgrestLike = { code?: string; message?: string; details?: string };

const isPostgrestError = (e: unknown): e is PostgrestLike =>
  typeof e === "object" && e !== null && "code" in e && typeof (e as PostgrestLike).code === "string";

/** Map Postgres / PostgREST error codes to messages that reveal no schema details. */
function messageForDbCode(code: string): { code: ErrorCode; message: string; status: number } {
  switch (code) {
    case "23505":
      return { code: "conflict", message: "That entry already exists.", status: 409 };
    case "23514":
    case "22003":
    case "22P02":
      return { code: "validation", message: "One of the values is outside the allowed range.", status: 400 };
    case "23503":
      return { code: "validation", message: "A related item could not be found.", status: 400 };
    case "42501":
    case "PGRST301":
      return { code: "forbidden", message: "You do not have permission to do that.", status: 403 };
    case "P0002":
    case "PGRST116":
      return { code: "not_found", message: "We could not find that item.", status: 404 };
    case "28000":
      return { code: "unauthenticated", message: "Please sign in to continue.", status: 401 };
    default:
      return { code: "unknown", message: GENERIC, status: 500 };
  }
}

/** Normalise anything thrown into a safe, user-facing description. Details go to server logs only. */
export function normalizeError(err: unknown): { code: ErrorCode; message: string; status: number; fieldErrors?: Record<string, string[]> } {
  if (err instanceof AppError) return { code: err.code, message: err.message, status: err.status };
  if (err instanceof ZodError) {
    const fieldErrors = err.flatten().fieldErrors as Record<string, string[]>;
    return { code: "validation", message: "Please check the highlighted fields.", status: 400, fieldErrors };
  }
  if (isPostgrestError(err) && err.code) {
    const mapped = messageForDbCode(err.code);
    if (mapped.code === "unknown") console.error("[db-error]", err.code, err.message);
    return mapped;
  }
  console.error("[unexpected-error]", err);
  return { code: "unknown", message: GENERIC, status: 500 };
}

export function toActionError(err: unknown): { ok: false; error: string; fieldErrors?: Record<string, string[]> } {
  const n = normalizeError(err);
  return { ok: false, error: n.message, ...(n.fieldErrors ? { fieldErrors: n.fieldErrors } : {}) };
}

/** Wrap a Server Action body so every failure becomes an ActionResult. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    // Next.js implements redirect()/notFound() by throwing; let those through untouched.
    if (typeof err === "object" && err !== null && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) {
      throw err;
    }
    return toActionError(err);
  }
}
