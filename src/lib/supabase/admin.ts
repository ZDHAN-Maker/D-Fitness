import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { getServiceRoleKey } from "@/lib/env.server";

/**
 * Service-role client. BYPASSES RLS.
 * Only for trusted server code that cannot act as the user (cron jobs, notification fan-out,
 * AI usage logging). Never import into Client Components and never return its results
 * without scoping them to a verified user id.
 *
 * Supports both the new SUPABASE_SECRET_KEY (@supabase/server) and legacy SUPABASE_SERVICE_ROLE_KEY.
 */
export function createAdminClient() {
  const key = getServiceRoleKey();
  if (!key) throw new Error("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not configured");
  return createClient(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
