"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { AppError, runAction, type ActionResult } from "@/lib/errors";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { safeRedirectPath } from "@/utils/safe-redirect";

async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? getPublicEnv().NEXT_PUBLIC_SITE_URL;
}

export async function signInAction(input: unknown, next?: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const { email, password } = loginSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Same message for unknown email and wrong password: do not reveal which accounts exist.
      if (error.code === "email_not_confirmed") throw new AppError("forbidden", "Confirm your email first. Check your inbox for the link.", 403);
      throw new AppError("unauthenticated", "Email or password is incorrect.", 401);
    }
  });
  if (!result.ok) return result;
  redirect(safeRedirectPath(next));
}

export async function signUpAction(input: unknown): Promise<ActionResult<{ needsEmailConfirmation: boolean }>> {
  const result = await runAction(async () => {
    const { email, password, displayName } = registerSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${await siteOrigin()}/auth/callback`,
      },
    });
    if (error) {
      if (error.code === "weak_password") throw new AppError("validation", "Choose a stronger password.");
      if (error.code === "over_email_send_rate_limit" || error.status === 429) {
        throw new AppError("rate_limited", "Too many attempts. Please wait a minute and try again.", 429);
      }
      throw new AppError("validation", "We could not create that account. Check your details and try again.");
    }
    // With email confirmation on, an existing address returns a user with no identities.
    if (data.user && data.user.identities?.length === 0) {
      throw new AppError("conflict", "An account with this email already exists. Try signing in.", 409);
    }
    return { needsEmailConfirmation: !data.session };
  });
  if (result.ok && !result.data.needsEmailConfirmation) redirect("/dashboard");
  return result;
}

export async function signInWithGoogleAction(): Promise<ActionResult> {
  const result = await runAction(async () => {
    if (!getPublicEnv().NEXT_PUBLIC_GOOGLE_AUTH_ENABLED) {
      throw new AppError("forbidden", "Google sign-in is not enabled.", 403);
    }
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${await siteOrigin()}/auth/callback` },
    });
    if (error || !data.url) throw new AppError("unknown", "Google sign-in is unavailable right now.", 502);
    return data.url;
  });
  if (!result.ok) return result;
  redirect(result.data);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
