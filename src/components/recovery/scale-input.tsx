"use client";

import { cn } from "@/lib/utils";

type Props = { id: string; label: string; low: string; high: string; value: number | undefined; onChange: (v: number | undefined) => void; error?: string };

/** 1–5 tap scale. Tapping the selected value again clears it (every question is optional). */
export function ScaleInput({ id, label, low, high, value, onChange, error }: Props) {
  return (
    <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
      <p id={`${id}-label`} className="text-sm font-medium">{label}</p>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${label}: ${n} of 5${n === 1 ? ` (${low})` : n === 5 ? ` (${high})` : ""}`}
            onClick={() => onChange(value === n ? undefined : n)}
            className={cn("h-12 rounded-md border text-base font-semibold tabular", value === n ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent")}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </div>
      {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
