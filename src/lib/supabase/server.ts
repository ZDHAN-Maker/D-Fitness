import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";

/**
 * Server client bound to the signed-in user's session (cookies).
 * RLS applies: this is the client to use in Server Components, Server Actions and Route Handlers.
 */
export async function createClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there.
          // Safe to ignore because middleware refreshes the session.
        }
      },
    },
  });
}
