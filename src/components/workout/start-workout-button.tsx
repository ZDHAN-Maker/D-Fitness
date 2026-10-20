"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { startWorkoutAction } from "@/features/workout/actions";

type Props = { date: string; planId?: string; name?: string; label?: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"] };

/** Starts a session (from a plan, or empty) and jumps straight into it. */
export function StartWorkoutButton({ date, planId, name, label = "Start", variant, size }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <span className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const res = await startWorkoutAction({ planId, name, date });
            if (!res.ok) return setError(res.error);
            router.push(`/workout/session/${res.data.sessionId}`);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Play />}
        {label}
      </Button>
      {error ? (
        <span role="alert" className="max-w-64 text-xs font-medium text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}
