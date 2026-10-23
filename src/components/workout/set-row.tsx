"use client";

import { useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatSetShort } from "@/lib/calculations/workout";
import type { SetView } from "@/features/workout/types";
import type { TrackingMode } from "@/types/domain";
import { cn } from "@/lib/utils";

export type SetValues = { weightKg?: number | null; reps?: number | null; durationSec?: number | null; distanceM?: number | null; rpe?: number | null; isWarmup?: boolean };

type Prev = { weight_kg: number | null; reps: number | null; duration_sec: number | null; distance_m: number | null } | undefined;

type Props = {
  index: number;
  set: SetView;
  mode: TrackingMode;
  prev: Prev;
  showDetails: boolean;
  error?: string;
  onSave: (patch: SetValues) => void;
  onToggle: (values: SetValues) => void;
  onDelete: () => void;
};

const text = (v: number | null | undefined, scale = 1) => (v === null || v === undefined ? "" : String(Math.round((v / scale) * 100) / 100));
const parse = (v: string, scale = 1): number | null => {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const x = Number(t);
  return Number.isFinite(x) ? x * scale : null;
};

/** Inputs depend on how the exercise is tracked (weight x reps, reps only, time, distance + time...). */
export function SetRow({ index, set, mode, prev, showDetails, error, onSave, onToggle, onDelete }: Props) {
  const [weight, setWeight] = useState(text(set.weight_kg));
  const [reps, setReps] = useState(text(set.reps));
  const [secs, setSecs] = useState(text(set.duration_sec));
  const [km, setKm] = useState(text(set.distance_m, 1000));
  const [mins, setMins] = useState(text(set.duration_sec, 60));
  const [rpe, setRpe] = useState(text(set.rpe));

  // Re-sync when the server returns a different value (e.g. "use suggestion").
  useEffect(() => setWeight(text(set.weight_kg)), [set.weight_kg]);
  useEffect(() => setReps(text(set.reps)), [set.reps]);
  useEffect(() => { setSecs(text(set.duration_sec)); setMins(text(set.duration_sec, 60)); }, [set.duration_sec]);
  useEffect(() => setKm(text(set.distance_m, 1000)), [set.distance_m]);
  useEffect(() => setRpe(text(set.rpe)), [set.rpe]);

  const hasWeight = mode === "weight_reps" || mode === "weight_duration";
  const hasReps = mode === "weight_reps" || mode === "reps_only";
  const hasSecs = mode === "duration" || mode === "weight_duration";
  const hasDistance = mode === "distance_duration";

  const current = (): SetValues => {
    const v: SetValues = { rpe: parse(rpe) };
    if (hasWeight) v.weightKg = parse(weight);
    if (hasReps) v.reps = parse(reps) === null ? null : Math.round(parse(reps) as number);
    if (hasSecs) v.durationSec = parse(secs) === null ? null : Math.round(parse(secs) as number);
    if (hasDistance) {
      v.distanceM = parse(km, 1000);
      v.durationSec = parse(mins, 60) === null ? null : Math.round(parse(mins, 60) as number);
    }
    return v;
  };

  const changed = (v: SetValues) => {
    const same = (a: number | null | undefined, b: number | null) => (a ?? null) === b;
    return (
      (v.weightKg !== undefined && !same(set.weight_kg, v.weightKg)) ||
      (v.reps !== undefined && !same(set.reps, v.reps)) ||
      (v.durationSec !== undefined && !same(set.duration_sec, v.durationSec)) ||
      (v.distanceM !== undefined && !same(set.distance_m, v.distanceM)) ||
      (v.rpe !== undefined && !same(set.rpe, v.rpe ?? null))
    );
  };

  const blur = () => {
    const v = current();
    if (changed(v)) onSave(v);
  };

  const done = set.is_completed;
  const inputCls = cn("h-11 text-center tabular", done && "bg-fiber/10");
  const prevText = prev ? formatSetShort(prev) : "–";
  const num = (id: string, label: string, value: string, setter: (v: string) => void, ph: string, step = "any", mode: "decimal" | "numeric" = "decimal") => (
    <Input id={id} aria-label={`${label}, set ${index + 1}`} type="number" inputMode={mode} step={step} min="0" placeholder={ph} value={value} onChange={(e) => setter(e.target.value)} onBlur={blur} className={inputCls} />
  );

  return (
    <li className={cn("rounded-md", done && "bg-fiber/5")}>
      <div className="grid items-center gap-2 py-1" style={{ gridTemplateColumns: `1.75rem minmax(3.5rem,1fr) ${"minmax(0,1fr) ".repeat(hasDistance || (hasWeight && (hasReps || hasSecs)) ? 2 : 1)}2.75rem` }}>
        <span className={cn("grid size-7 place-items-center rounded-full text-xs font-semibold", set.is_warmup ? "bg-carbs/20 text-carbs" : "bg-muted text-muted-foreground")} title={set.is_warmup ? "Warm-up set" : undefined}>
          {set.is_warmup ? "W" : index + 1}
        </span>
        <span className="tabular truncate text-xs text-muted-foreground" aria-label={`Previous: ${prevText}`}>
          {prevText}
        </span>
        {hasWeight ? num(`w-${set.id}`, "Weight in kilograms", weight, setWeight, text(prev?.weight_kg) || "kg", "0.5") : null}
        {hasReps ? num(`r-${set.id}`, "Reps", reps, setReps, text(prev?.reps) || "reps", "1", "numeric") : null}
        {hasSecs ? num(`s-${set.id}`, "Seconds", secs, setSecs, text(prev?.duration_sec) || "sec", "1", "numeric") : null}
        {hasDistance ? (
          <>
            {num(`k-${set.id}`, "Distance in kilometres", km, setKm, "km", "0.01")}
            {num(`m-${set.id}`, "Time in minutes", mins, setMins, "min", "0.5")}
          </>
        ) : null}
        <button
          type="button"
          aria-pressed={done}
          aria-label={done ? `Mark set ${index + 1} not done` : `Complete set ${index + 1}`}
          onClick={() => onToggle(current())}
          className={cn("grid size-11 place-items-center rounded-md border active:scale-95 transition-transform select-none", done ? "border-fiber bg-fiber text-background" : "bg-card text-muted-foreground hover:bg-accent")}
        >
          <Check className="size-5" aria-hidden="true" />
        </button>
      </div>

      {showDetails ? (
        <div className="flex flex-wrap items-center gap-3 pb-2 pl-9 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">RPE</span>
            <Input aria-label={`RPE, set ${index + 1}`} type="number" inputMode="decimal" step="0.5" min="1" max="10" value={rpe} onChange={(e) => setRpe(e.target.value)} onBlur={blur} className="h-9 w-20 text-center" />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-5 accent-[hsl(var(--primary))]" checked={set.is_warmup} onChange={(e) => onSave({ isWarmup: e.target.checked })} />
            Warm-up
          </label>
          <button type="button" onClick={onDelete} className="ml-auto flex items-center gap-1 text-destructive hover:underline">
            <Trash2 className="size-4" aria-hidden="true" /> Remove set
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="pb-2 pl-9 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
