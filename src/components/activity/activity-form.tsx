"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { saveActivityAction } from "@/features/activity/actions";
import type { ActivityTypeRow } from "@/features/activity/service";
import { calculateCaloriesBurned, calculatePaceSecPerKm, calculateSpeedKmh, formatPace, parseDurationToMinutes } from "@/lib/calculations/workout";
import { activitySchema } from "@/lib/validations/activity";

export type ActivityInitial = { id?: string; activityTypeId?: number; date: string; duration: string; distance: string; calories: string; notes: string };

type Props = { types: ActivityTypeRow[]; initial: ActivityInitial; latestWeightKg: number | null };

const cap = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function ActivityForm({ types, initial, latestWeightKg }: Props) {
  const router = useRouter();
  const [typeId, setTypeId] = useState(initial.activityTypeId ? String(initial.activityTypeId) : "");
  const [date, setDate] = useState(initial.date);
  const [duration, setDuration] = useState(initial.duration);
  const [distance, setDistance] = useState(initial.distance);
  const [calories, setCalories] = useState(initial.calories);
  const [notes, setNotes] = useState(initial.notes);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const type = types.find((t) => String(t.id) === typeId);
  const minutes = parseDurationToMinutes(duration);
  const km = distance.trim() === "" ? null : Number(distance);
  const pace = type?.tracks_pace && minutes && km ? calculatePaceSecPerKm(minutes, km) : null;
  const speed = type?.tracks_distance && minutes && km ? calculateSpeedKmh(minutes, km) : null;
  const estimate = type && minutes ? calculateCaloriesBurned(type.met_value, latestWeightKg, minutes) : null;

  const groups = [...new Set(types.map((t) => t.category ?? "other"))];

  const submit = () => {
    setServerError(undefined);
    const payload = {
      id: initial.id,
      activityTypeId: typeId === "" ? undefined : Number(typeId),
      date,
      durationMinutes: minutes ?? Number.NaN,
      distanceKm: type?.tracks_distance && distance.trim() !== "" ? Number(distance) : undefined,
      caloriesBurned: calories.trim() === "" ? undefined : Number(calories),
      notes,
    };
    const parsed = activitySchema.safeParse(payload);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const i of parsed.error.issues) e[String(i.path[0])] ??= i.message;
      if (minutes === null && duration.trim() !== "") e.durationMinutes = "Use minutes (45) or a time like 28:30";
      return setErrors(e);
    }
    setErrors({});
    startTransition(async () => {
      const res = await saveActivityAction(payload);
      if (!res.ok) return setServerError(res.error);
      router.push("/activity");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {serverError ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="act-type" label="Activity" error={errors.activityTypeId}>
          <Select {...fieldAria("act-type", errors.activityTypeId)} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">Choose…</option>
            {groups.map((g) => (
              <optgroup key={g} label={cap(g)}>
                {types.filter((t) => (t.category ?? "other") === g).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field id="act-date" label="Date" error={errors.date}>
          <Input {...fieldAria("act-date", errors.date)} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field id="act-duration" label="Duration" error={errors.durationMinutes} hint="Minutes (45) or time (1:05:00).">
          <Input {...fieldAria("act-duration", errors.durationMinutes, "hint")} inputMode="text" placeholder="e.g. 28:30" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
        {type?.tracks_distance ? (
          <Field id="act-distance" label="Distance (km)" error={errors.distanceKm}>
            <Input {...fieldAria("act-distance", errors.distanceKm)} type="number" inputMode="decimal" step="0.01" min="0" value={distance} onChange={(e) => setDistance(e.target.value)} />
          </Field>
        ) : null}
        <Field id="act-cal" label="Calories burned (optional)" error={errors.caloriesBurned} hint={estimate ? `Leave empty (or clear it) to estimate: about ${estimate} kcal.` : latestWeightKg ? undefined : "Log your weight to get automatic estimates."}>
          <Input {...fieldAria("act-cal", errors.caloriesBurned, estimate || !latestWeightKg ? "hint" : undefined)} type="number" inputMode="numeric" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} />
        </Field>
        <Field id="act-notes" label="Notes (optional)" error={errors.notes}>
          <Input {...fieldAria("act-notes", errors.notes)} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      {pace || speed ? (
        <p aria-live="polite" className="tabular rounded-lg bg-muted p-3 text-sm">
          {pace ? <>Pace <strong>{formatPace(pace)}</strong></> : null}
          {pace && speed ? " · " : null}
          {speed ? <>Speed <strong>{speed} km/h</strong></> : null}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {initial.id ? "Save changes" : "Log activity"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/activity")}>Cancel</Button>
      </div>
    </div>
  );
}
