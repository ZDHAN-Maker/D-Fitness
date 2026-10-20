"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/calculations/workout";

type Props = { endsAt: number; totalSeconds: number; onAdjust: (deltaSeconds: number) => void; onDismiss: () => void };

/**
 * Rest countdown. It counts against a wall-clock end time (not by decrementing),
 * so it stays correct when the phone throttles the tab or the screen sleeps.
 */
export function RestTimer({ endsAt, totalSeconds, onAdjust, onDismiss }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const done = remaining === 0;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (done && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
  }, [done]);

  const pct = totalSeconds > 0 ? Math.min(100, ((totalSeconds - remaining) / totalSeconds) * 100) : 100;

  return (
    <div className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-xl border bg-card p-3 shadow-xl md:bottom-6">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" aria-label="Subtract 15 seconds" onClick={() => onAdjust(-15)}>
          <Minus />
        </Button>
        <div className="flex-1 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{done ? "Rest over" : "Rest"}</p>
          <p role="timer" aria-live="off" className={`tabular font-display text-3xl font-bold leading-none ${done ? "text-fiber" : ""}`}>
            {formatClock(remaining)}
          </p>
        </div>
        <Button type="button" variant="outline" size="icon" aria-label="Add 15 seconds" onClick={() => onAdjust(15)}>
          <Plus />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Skip rest" onClick={onDismiss}>
          <X />
        </Button>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="sr-only" role="status">{done ? "Rest is over. Start your next set." : ""}</p>
    </div>
  );
}
