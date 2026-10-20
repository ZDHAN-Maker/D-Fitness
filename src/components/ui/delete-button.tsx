"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";

/** Two-step delete (no accidental taps). `action` is a Server Action passed from a Server Component. */
export function DeleteButton({ label, action, onDone, verb = "Delete" }: { label: string; action: () => Promise<ActionResult>; onDone?: () => void; verb?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <span className="flex flex-col items-end gap-1">
        <Button type="button" variant="ghost" size="icon" aria-label={`${verb} ${label}`} onClick={() => { setError(undefined); setConfirming(true); }}>
          <Trash2 />
        </Button>
        {error ? (
          <span role="alert" className="max-w-56 text-right text-xs font-medium text-destructive">
            {error}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex items-center gap-1" role="group" aria-label={`Confirm ${verb.toLowerCase()} ${label}`}>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await action();
              if (!res.ok) {
                setError(res.error);
                setConfirming(false);
              } else onDone?.();
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          {verb}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
      {error ? (
        <span role="alert" className="max-w-56 text-right text-xs font-medium text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}
