"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, fieldAria } from "@/components/ui/field";
import { GoogleButton } from "@/components/auth/google-button";
import { signUpAction } from "@/features/auth/actions";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [serverError, setServerError] = useState<string>();
  const [confirmEmail, setConfirmEmail] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), defaultValues: { displayName: "", email: "", password: "" } });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const res = await signUpAction(values);
      if (!res.ok) return setServerError(res.error);
      if (res.data.needsEmailConfirmation) setConfirmEmail(values.email);
    });
  });

  if (confirmEmail) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
        <MailCheck className="size-10 text-primary" aria-hidden="true" />
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <span className="font-medium text-foreground">{confirmEmail}</span>. Open it to finish creating your account.
        </p>
        <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {serverError ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      <Field id="displayName" label="Name" error={errors.displayName?.message}>
        <Input {...fieldAria("displayName", errors.displayName?.message)} autoComplete="name" {...register("displayName")} />
      </Field>

      <Field id="email" label="Email" error={errors.email?.message}>
        <Input {...fieldAria("email", errors.email?.message)} type="email" autoComplete="email" inputMode="email" {...register("email")} />
      </Field>

      <Field id="password" label="Password" error={errors.password?.message} hint="At least 8 characters, with a letter and a number.">
        <Input
          {...fieldAria("password", errors.password?.message, "hint")}
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Create account
      </Button>

      {googleEnabled ? <GoogleButton /> : null}

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
