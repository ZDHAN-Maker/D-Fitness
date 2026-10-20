import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ROUTES, PROTECTED_PREFIXES } from "@/constants/navigation";
import { getPublicEnv } from "@/lib/env";

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + "/");

/** Refreshes the Supabase session cookie on every request and enforces route protection. */
export async function updateSession(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not run code between createServerClient and getUser(): it can cause hard-to-debug logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => matches(path, p));
  const isAuthRoute = AUTH_ROUTES.some((p) => matches(path, p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
