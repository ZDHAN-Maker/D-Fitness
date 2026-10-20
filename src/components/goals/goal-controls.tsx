"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { addGoalProgressAction, deleteGoalAction, setGoalStatusAction } from "@/features/goals/actions";
import { manualProgressSchema } from "@/lib/validations/goals";

export function GoalStatusControls({ id, status }: { id: string; status: "active" | "completed" | "paused" | "abandoned" }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const change = (next: "active" | "paused" | "abandoned") =>
    startTransition(async () => {
      setError(undefined);
      const res = await setGoalStatusAction({ id, status: next });
      if (!res.ok) return setError(res.error);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === "active" ? (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => change("paused")}><Pause /> Pause</Button>
        ) : status === "paused" || status === "abandoned" ? (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => change("active")}>{pending ? <Loader2 className="animate-spin" /> : <Play />} Resume</Button>
        ) : null}
        {status === "active" || status === "paused" ? (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => change("abandoned")}><XCircle /> Stop tracking</Button>
        ) : null}
        <DeleteButton label="goal" action={() => deleteGoalAction(id)} onDone={() => { router.push("/goals"); router.refresh(); }} />
      </div>
      {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

export function ManualProgressForm({ goalId, today, unit }: { goalId: string; today: string; unit: string | null }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [value, setValue] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(undefined);
    const payload = { goalId, date, value: value.trim() === "" ? Number.NaN : Number(value.replace(",", ".")) };
    const parsed = manualProgressSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    setErrors({});
    startTransition(async () => {
      const res = await addGoalProgressAction(payload);
      setStatus(res.ok ? { ok: true, text: "Updated." } : { ok: false, text: res.error });
      if (res.ok) {
        setValue("");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field id="mp-value" label={`Current value${unit ? ` (${unit})` : ""}`} error={errors.value}>
        <Input {...fieldAria("mp-value", errors.value)} type="number" inputMode="decimal" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <Field id="mp-date" label="Date" error={errors.date}>
        <Input {...fieldAria("mp-date", errors.date)} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Button type="submit" disabled={pending} className="sm:mb-[1.4rem]">{pending ? <Loader2 className="animate-spin" /> : null} Update</Button>
      {status ? <p role={status.ok ? "status" : "alert"} className={`text-sm font-medium sm:col-span-3 ${status.ok ? "text-fiber" : "text-destructive"}`}>{status.text}</p> : null}
    </form>
  );
}
