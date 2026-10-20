import "server-only";
import { z } from "zod";

/**
 * Server-only secrets. Importing this file from a Client Component fails the build.
 *
 * Supports both the new @supabase/server naming (SUPABASE_SECRET_KEY, SUPABASE_JWKS_URL)
 * and the legacy naming (SUPABASE_SERVICE_ROLE_KEY).
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  AI_PROVIDER: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL_TEXT: z.string().optional(),
  AI_MODEL_VISION: z.string().optional(),
  AI_BASE_URL: z.string().url().startsWith("https://").optional(),
  AI_DAILY_LIMIT: z.coerce.number().int().min(1).max(10_000).optional(),
  AI_DAILY_VISION_LIMIT: z.coerce.number().int().min(0).max(10_000).optional(),
  CRON_SECRET: z.string().min(16).optional(),
});

let cached: z.infer<typeof serverSchema> | undefined;

export function getServerEnv() {
  if (!cached) {
    // An empty value in .env (KEY=) means "not set", not "invalid".
    const clean = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ""));
    cached = serverSchema.parse(clean);
  }
  return cached;
}

/** Get the service role key, preferring SUPABASE_SECRET_KEY over the legacy SUPABASE_SERVICE_ROLE_KEY. */
export function getServiceRoleKey(): string | undefined {
  const env = getServerEnv();
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
}
