import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { getPublicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick up where you left off.</p>
      </div>
      <LoginForm
        next={next}
        googleEnabled={getPublicEnv().NEXT_PUBLIC_GOOGLE_AUTH_ENABLED}
        initialError={error === "auth_callback" ? "That sign-in link has expired. Please try again." : undefined}
      />
    </div>
  );
}
