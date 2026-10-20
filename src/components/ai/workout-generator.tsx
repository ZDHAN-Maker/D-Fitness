"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Dumbbell, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { postAi } from "@/components/ai/ai-client";
import { addGeneratedWorkoutToPlanAction } from "@/features/ai/actions";
import type { GeneratedWorkout } from "@/features/ai/workout-gen";
import { formatClock } from "@/lib/calculations/workout";
import { FOCUS, GOALS } from "@/lib/validations/ai";
import { cn } from "@/lib/utils";

const GOAL_LABEL: Record<(typeof GOALS)[number], string> = { strength: "Strength", hypertrophy: "Muscle growth", endurance: "Endurance", fat_loss: "Fat loss / conditioning", general: "General fitness" };
const FOCUS_LABEL: Record<(typeof FOCUS)[number], string> = { full_body: "Full body", upper: "Upper body", lower: "Lower body", push: "Push", pull: "Pull", legs: "Legs", core: "Core" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function WorkoutGenerator({ equipmentOptions, defaultEquipment, disabled }: { equipmentOptions: string[]; defaultEquipment: string[]; disabled: boolean }) {
  const [minutes, setMinutes] = useState("30");
  const [goal, setGoal] = useState<(typeof GOALS)[number]>("general");
  const [focus, setFocus] = useState<(typeof FOCUS)[number]>("full_body");
  const [equipment, setEquipment] = useState<string[]>(defaultEquipment);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<GeneratedWorkout>();
  const [planName, setPlanName] = useState("");
  const [planId, setPlanId] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [saving, startSave] = useTransition();

  const mins = Number(minutes);
  const minutesOk = Number.isInteger(mins) && mins >= 10 && mins <= 120;

  const generate = () => {
    setError(undefined);
    setPlanId(undefined);
    startTransition(async () => {
      const res = await postAi<GeneratedWorkout>("/api/ai/workout-generator", { minutes: mins, goal, focus, equipment, note });
      if (!res.ok) return setError(res.error);
      setResult(res.data);
      setPlanName(res.data.workout.title);
    });
  };

  const save = () => {
    if (!result) return;
    setError(undefined);
    startSave(async () => {
      const res = await addGeneratedWorkoutToPlanAction({ generatedId: result.id, name: planName });
      if (!res.ok) return setError(res.error);
      setPlanId(res.data.planId);
    });
  };

  const w = result?.workout;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Tell it how much time you have. It builds a session from your own exercise library, considering your equipment, recent training and recovery.</p>

      <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <Field id="wg-min" label="Time available (minutes)" error={minutes !== "" && !minutesOk ? "Between 10 and 120 minutes" : undefined}>
          <Input {...fieldAria("wg-min", minutes !== "" && !minutesOk ? "x" : undefined)} type="number" inputMode="numeric" min="10" max="120" step="5" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          <div className="flex gap-2 pt-1" role="group" aria-label="Quick durations">
            {[20, 30, 45, 60].map((m) => <button key={m} type="button" onClick={() => setMinutes(String(m))} className={cn("h-9 rounded-full border px-3 text-sm", mins === m ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent")}>{m}</button>)}
          </div>
        </Field>
        <div className="grid gap-4">
          <Field id="wg-goal" label="Goal">
            <Select {...fieldAria("wg-goal")} value={goal} onChange={(e) => setGoal(e.target.value as typeof goal)}>{GOALS.map((g) => <option key={g} value={g}>{GOAL_LABEL[g]}</option>)}</Select>
          </Field>
          <Field id="wg-focus" label="Focus">
            <Select {...fieldAria("wg-focus")} value={focus} onChange={(e) => setFocus(e.target.value as typeof focus)}>{FOCUS.map((f) => <option key={f} value={f}>{FOCUS_LABEL[f]}</option>)}</Select>
          </Field>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">Equipment you have <span className="font-normal text-muted-foreground">(bodyweight is always included)</span></legend>
          <div className="flex flex-wrap gap-2">
            {equipmentOptions.filter((e) => e.toLowerCase() !== "bodyweight").map((e) => {
              const on = equipment.includes(e);
              return <button key={e} type="button" aria-pressed={on} onClick={() => setEquipment(on ? equipment.filter((x) => x !== e) : [...equipment, e])} className={cn("h-10 rounded-full border px-4 text-sm font-medium", on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent")}>{cap(e)}</button>;
            })}
          </div>
          {equipment.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">None selected: all equipment is considered.</p> : null}
        </fieldset>
        <Field id="wg-note" label="Anything else? (optional)" className="sm:col-span-2">
          <Input {...fieldAria("wg-note")} maxLength={200} placeholder="e.g. sore shoulders, short on time" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button type="button" onClick={generate} disabled={disabled || pending || !minutesOk} className="sm:col-span-2">
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate workout
        </Button>
      </div>

      {error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {w && result ? (
        <article className="rounded-lg border bg-card p-4" aria-label="Generated workout">
          <h3 className="font-display text-xl font-semibold">{w.title}</h3>
          <p className="tabular mt-0.5 text-sm text-muted-foreground">About {w.estimatedMinutes} min · {w.exercises.length} exercises</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {w.trimmed ? <Badge variant="muted">Shortened to fit {result.params.minutes} min</Badge> : null}
            {w.recoveryCapped ? <Badge variant="muted">Volume reduced: low recovery today</Badge> : null}
            {result.recoveryScore !== null ? <Badge variant="outline">Recovery {result.recoveryScore}/100</Badge> : null}
          </div>
          {w.rationale ? <p className="mt-3 text-sm">{w.rationale}</p> : null}

          <ol className="mt-3 divide-y">
            {w.exercises.map((e, i) => (
              <li key={e.exerciseId} className="flex items-center gap-3 py-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.name}</p>
                  <p className="tabular text-sm text-muted-foreground">{e.sets} × {e.durationSec ? formatClock(e.durationSec) : e.repsMin === e.repsMax ? `${e.repsMin} reps` : `${e.repsMin}–${e.repsMax} reps`} · rest {e.restSeconds}s</p>
                  {e.note ? <p className="text-xs text-muted-foreground">{e.note}</p> : null}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4 border-t pt-4">
            {planId ? (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-fiber"><span className="flex items-center gap-1.5"><Check className="size-4" aria-hidden="true" /> Added to your workout plans.</span> <Link href={`/workout/plans/${planId}`} className="underline underline-offset-4">Edit plan</Link> <Link href="/workout/plans" className="underline underline-offset-4">Start it</Link></p>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <Field id="wg-name" label="Plan name" className="min-w-48 flex-1">
                  <Input {...fieldAria("wg-name")} maxLength={60} value={planName} onChange={(e) => setPlanName(e.target.value)} />
                </Field>
                <Button type="button" variant="secondary" disabled={saving || !planName.trim()} onClick={save}>{saving ? <Loader2 className="animate-spin" /> : <Dumbbell />} Add to Workout Plan</Button>
              </div>
            )}
          </div>
        </article>
      ) : null}
    </div>
  );
}
