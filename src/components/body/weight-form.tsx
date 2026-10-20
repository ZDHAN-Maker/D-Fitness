"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveWeightAction } from "@/features/body/actions";
import { weightSchema } from "@/lib/validations/body";

export function WeightForm({ today, lastWeightKg }: { today: string; lastWeightKg: number | null }) {
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState(lastWeightKg ? String(lastWeightKg) : "");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(undefined);
    const payload = { date, weightKg: weight.trim() === "" ? Number.NaN : Number(weight.replace(",", ".")), note };
    const parsed = weightSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    setErrors({});
    startTransition(async () => {
      const res = await saveWeightAction(payload);
      setStatus(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
      if (res.ok) setNote("");
    });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field id="w-weight" label="Weight (kg)" error={errors.weightKg}>
        <Input {...fieldAria("w-weight", errors.weightKg)} type="number" inputMode="decimal" step="0.1" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} className="text-lg font-semibold" />
      </Field>
      <Field id="w-date" label="Date" error={errors.date} hint="Logging the same date again replaces it.">
        <Input {...fieldAria("w-date", errors.date, "hint")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Button type="submit" disabled={pending} className="sm:mb-[1.4rem]">
        {pending ? <Loader2 className="animate-spin" /> : null}
        Save
      </Button>
      <Field id="w-note" label="Note (optional)" error={errors.note} className="sm:col-span-3">
        <Input {...fieldAria("w-note", errors.note)} placeholder="e.g. after waking up" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {status ? (
        <p role={status.ok ? "status" : "alert"} className={`text-sm font-medium sm:col-span-3 ${status.ok ? "text-fiber" : "text-destructive"}`}>
          {status.text}
        </p>
      ) : null}
    </form>
  );
}
