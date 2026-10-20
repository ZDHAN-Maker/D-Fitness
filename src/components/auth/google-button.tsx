"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signInWithGoogleAction } from "@/features/auth/actions";

export function GoogleButton() {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await signInWithGoogleAction();
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        Continue with Google
      </Button>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
