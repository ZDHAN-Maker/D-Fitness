"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, fieldAria } from "@/components/ui/field";
import { GoogleButton } from "@/components/auth/google-button";
import { signInAction } from "@/features/auth/actions";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export function LoginForm({ next, googleEnabled, initialError }: { next?: string; googleEnabled: boolean; initialError?: string }) {
  const [serverError, setServerError] = useState<string | undefined>(initialError);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const res = await signInAction(values, next);
      if (res && !res.ok) setServerError(res.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {serverError ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      <Field id="email" label="Email" error={errors.email?.message}>
        <Input {...fieldAria("email", errors.email?.message)} type="email" autoComplete="email" inputMode="email" {...register("email")} />
      </Field>

      <Field id="password" label="Password" error={errors.password?.message}>
        <Input {...fieldAria("password", errors.password?.message)} type="password" autoComplete="current-password" {...register("password")} />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Sign in
      </Button>

      {googleEnabled ? <GoogleButton /> : null}

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
