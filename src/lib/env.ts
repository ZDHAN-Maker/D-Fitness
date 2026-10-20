import { z } from "zod";

/**
 * Public environment (safe for the browser). Validated lazily so `next build`
 * does not fail on pages that never touch Supabase.
 *
 * Supports both the new @supabase/server naming (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
 * and the legacy NEXT_PUBLIC_* naming. The NEXT_PUBLIC_* vars are still needed because
 * Next.js only inlines env vars prefixed with NEXT_PUBLIC_ into the client bundle.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type PublicEnv = z.infer<typeof publicSchema>;
let cached: PublicEnv | undefined;

export function getPublicEnv(): PublicEnv {
  if (cached) return cached;
  // NEXT_PUBLIC_* must be referenced statically so Next can inline them into the client bundle.
  // Fall back to SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY for server-side code.
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED || undefined,
  });
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ");
    throw new Error("Invalid environment configuration. " + problems);
  }
  cached = parsed.data;
  return cached;
}
