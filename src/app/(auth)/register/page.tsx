import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { getPublicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your data stays private to you.</p>
      </div>
      <RegisterForm googleEnabled={getPublicEnv().NEXT_PUBLIC_GOOGLE_AUTH_ENABLED} />
    </div>
  );
}
