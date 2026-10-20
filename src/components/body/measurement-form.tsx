"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveMeasurementAction } from "@/features/body/actions";
import { measurementSchema } from "@/lib/validations/body";

const FIELDS = [
  { key: "waistCm", label: "Waist (cm)" },
  { key: "chestCm", label: "Chest (cm)" },
  { key: "armCm", label: "Arm (cm)" },
  { key: "thighCm", label: "Thigh (cm)" },
  { key: "hipCm", label: "Hip (cm)" },
  { key: "bodyFatPct", label: "Body fat (%)" },
] as const;

export function MeasurementForm({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(undefined);
    const payload: Record<string, unknown> = { date };
    for (const f of FIELDS) payload[f.key] = (values[f.key] ?? "").trim() === "" ? undefined : Number((values[f.key] ?? "").replace(",", "."));
    const parsed = measurementSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    setErrors({});
    startTransition(async () => {
      const res = await saveMeasurementAction(payload);
      setStatus(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
      if (res.ok) setValues({});
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <Field id="m-date" label="Date" error={errors.date} hint="Measurements you enter are added to that date's entry; empty fields are left alone." className="max-w-xs">
        <Input {...fieldAria("m-date", errors.date, "hint")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <Field key={f.key} id={`m-${f.key}`} label={f.label} error={errors[f.key]}>
            <Input {...fieldAria(`m-${f.key}`, errors[f.key])} type="number" inputMode="decimal" step="0.1" min="0" value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
          </Field>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save measurements
        </Button>
        {status ? (
          <p role={status.ok ? "status" : "alert"} className={`text-sm font-medium ${status.ok ? "text-fiber" : "text-destructive"}`}>
            {status.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
