"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ExerciseBrowser } from "@/components/workout/exercise-browser";
import { saveGoalAction } from "@/features/goals/actions";
import type { GoalTemplate } from "@/features/goals/service";
import type { ExerciseFacets } from "@/features/workout/exercises";
import { GOAL_TYPES, RUN_DISTANCES, findMetric, metricsFor } from "@/lib/goals/metrics";
import { goalSchema } from "@/lib/validations/goals";
import { addDays } from "@/utils/date";
import type { GoalType } from "@/types/domain";

export type GoalInitial = {
  id?: string;
  templateId?: number;
  type: GoalType;
  title: string;
  metric: string;
  direction: "increase" | "decrease";
  target: string;
  start: string;
  unit: string;
  startDate: string;
  targetDate: string;
  exercise: { id: number; name: string } | null;
  distanceKm: string;
};

type Props = { initial: GoalInitial; templates: GoalTemplate[]; facets: ExerciseFacets; categories: { id: number; name: string }[]; today: string };

export function GoalForm({ initial, templates, facets, categories, today }: Props) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof GoalInitial>(k: K, v: GoalInitial[K]) => setF((s) => ({ ...s, [k]: v }));

  const metric = findMetric(f.metric);
  const metrics = metricsFor(f.type);

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => String(x.id) === id);
    if (!t) return setF((s) => ({ ...s, templateId: undefined }));
    setF((s) => ({
      ...s,
      templateId: t.id,
      type: t.type as GoalType,
      title: t.title,
      metric: t.metric,
      direction: t.direction,
      target: t.target === null ? "" : String(t.target),
      unit: t.unit,
      targetDate: t.durationDays ? addDays(s.startDate, t.durationDays) : "",
      distanceKm: t.distanceKm ? String(t.distanceKm) : "",
      exercise: t.exercise ?? s.exercise,
    }));
  };

  const changeType = (type: GoalType) => {
    const first = metricsFor(type)[0]!;
    setF((s) => ({ ...s, type, metric: first.key, direction: first.direction, exercise: null, distanceKm: "" }));
  };
  const changeMetric = (key: string) => {
    const m = findMetric(key);
    setF((s) => ({ ...s, metric: key, direction: m?.direction ?? s.direction, distanceKm: m?.needsDistance ? "5" : "" }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(undefined);
    const payload = {
      id: f.id,
      templateId: f.templateId,
      type: f.type,
      title: f.title,
      metric: f.metric,
      direction: f.direction,
      targetValue: f.target.trim() === "" ? Number.NaN : Number(f.target.replace(",", ".")),
      startValue: f.start.trim() === "" ? undefined : Number(f.start.replace(",", ".")),
      unit: f.unit,
      startDate: f.startDate,
      targetDate: f.targetDate,
      exerciseId: f.exercise?.id,
      distanceKm: f.distanceKm.trim() === "" ? undefined : Number(f.distanceKm),
    };
    const parsed = goalSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    setErrors({});
    startTransition(async () => {
      const res = await saveGoalAction(payload);
      if (!res.ok) return setServerError(res.error);
      router.push(`/goals/${res.data.id}`);
      router.refresh();
    });
  };

  const unitLabel = metric && metric.key !== "custom" ? metric.unit : f.unit;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {serverError ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p> : null}

      {!f.id ? (
        <Field id="g-template" label="Start from a template (optional)">
          <Select {...fieldAria("g-template")} value={f.templateId ? String(f.templateId) : ""} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">Build my own</option>
            {GOAL_TYPES.map((t) => (
              <optgroup key={t.key} label={t.label}>
                {templates.filter((x) => x.type === t.key).map((x) => (
                  <option key={x.id} value={x.id}>{x.title}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="g-type" label="Type">
          <Select {...fieldAria("g-type")} value={f.type} onChange={(e) => changeType(e.target.value as GoalType)}>
            {GOAL_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </Select>
        </Field>
        <Field id="g-metric" label="What to track" error={errors.metric} hint={metric?.hint}>
          <Select {...fieldAria("g-metric", errors.metric, metric?.hint ? "hint" : undefined)} value={f.metric} onChange={(e) => changeMetric(e.target.value)}>
            {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}{m.unit ? ` (${m.unit})` : ""}</option>)}
          </Select>
        </Field>

        <Field id="g-title" label="Goal name" error={errors.title} className="sm:col-span-2">
          <Input {...fieldAria("g-title", errors.title)} placeholder="e.g. Reach 70 kg" value={f.title} onChange={(e) => set("title", e.target.value)} />
        </Field>

        {metric?.needsExercise ? (
          <Field id="g-exercise" label="Exercise" error={errors.exerciseId} className="sm:col-span-2">
            <div className="flex items-center gap-2">
              <span className="min-h-11 flex-1 rounded-md border bg-card px-3 py-2.5 text-sm">{f.exercise ? f.exercise.name : <span className="text-muted-foreground">None chosen</span>}</span>
              <Button type="button" variant="outline" onClick={() => setPicking(true)}>Choose</Button>
            </div>
          </Field>
        ) : null}

        {metric?.needsDistance ? (
          <Field id="g-distance" label="Distance" error={errors.distanceKm}>
            <Select {...fieldAria("g-distance", errors.distanceKm)} value={f.distanceKm} onChange={(e) => set("distanceKm", e.target.value)}>
              <option value="">Choose…</option>
              {RUN_DISTANCES.map((d) => <option key={d.km} value={d.km}>{d.label}</option>)}
            </Select>
          </Field>
        ) : null}

        <Field id="g-direction" label="Direction">
          <Select {...fieldAria("g-direction")} value={f.direction} onChange={(e) => set("direction", e.target.value as "increase" | "decrease")}>
            <option value="decrease">Go down</option>
            <option value="increase">Go up</option>
          </Select>
        </Field>

        {metric?.key === "custom" ? (
          <Field id="g-unit" label="Unit (optional)" error={errors.unit}>
            <Input {...fieldAria("g-unit", errors.unit)} placeholder="e.g. books" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
          </Field>
        ) : null}

        <Field id="g-target" label={`Target${unitLabel ? ` (${unitLabel})` : ""}${metric?.key === "run_time_min" ? ", in minutes" : ""}`} error={errors.targetValue}>
          <Input {...fieldAria("g-target", errors.targetValue)} type="number" inputMode="decimal" step="any" value={f.target} onChange={(e) => set("target", e.target.value)} />
        </Field>
        <Field id="g-start" label="Start value (optional)" error={errors.startValue} hint={metric?.auto ? (metric.rate ? "Leave empty to start from 0." : "Leave empty to start from your current value.") : undefined}>
          <Input {...fieldAria("g-start", errors.startValue, metric?.auto ? "hint" : undefined)} type="number" inputMode="decimal" step="any" value={f.start} onChange={(e) => set("start", e.target.value)} />
        </Field>
        <Field id="g-startdate" label="Start date" error={errors.startDate}>
          <Input {...fieldAria("g-startdate", errors.startDate)} type="date" value={f.startDate} max={addDays(today, 7)} onChange={(e) => set("startDate", e.target.value)} />
        </Field>
        <Field id="g-targetdate" label="Target date (optional)" error={errors.targetDate}>
          <Input {...fieldAria("g-targetdate", errors.targetDate)} type="date" value={f.targetDate} onChange={(e) => set("targetDate", e.target.value)} />
        </Field>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {f.id ? "Save changes" : "Create goal"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>

      <BottomSheet open={picking} onClose={() => setPicking(false)} title="Choose exercise" wide>
        <ExerciseBrowser facets={facets} categories={categories} onSelect={(e) => { set("exercise", { id: e.id, name: e.name }); setPicking(false); }} />
      </BottomSheet>
    </form>
  );
}
