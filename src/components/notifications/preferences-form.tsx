"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { savePrefsAction } from "@/features/notifications/actions";
import type { NotificationPrefs } from "@/lib/notifications/rules";
import { notificationPrefsSchema } from "@/lib/validations/goals";

const TOGGLES = [
  { key: "workout_reminders", label: "Workout reminders", help: "A scheduled workout you have not started, and streaks about to end." },
  { key: "nutrition_reminders", label: "Nutrition", help: "Protein gap in the evening (only on days you log food)." },
  { key: "hydration_reminders", label: "Hydration", help: "When you are well below your usual water intake." },
  { key: "recovery_alerts", label: "Recovery alerts", help: "A short night, with a suggestion to ease training." },
] as const;

export function PreferencesForm({ initial }: { initial: NotificationPrefs }) {
  const [p, setP] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(undefined);
    const parsed = notificationPrefsSchema.safeParse(p);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    setErrors({});
    startTransition(async () => {
      const res = await savePrefsAction(parsed.data);
      setStatus(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
    });
  };

  const check = (id: string, label: string, help: string | undefined, checked: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <label htmlFor={id} className="flex items-start gap-3 py-2">
      <input id={id} type="checkbox" className="mt-1 size-5 accent-[hsl(var(--primary))]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {help ? <span className="block text-xs text-muted-foreground">{help}</span> : null}
      </span>
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <h2 className="font-display text-lg font-semibold">Preferences</h2>
      {check("n-enabled", "Notifications", "Turn everything off with one switch.", p.enabled, (v) => setP({ ...p, enabled: v }))}
      <div className="flex flex-col divide-y border-y">
        {TOGGLES.map((t) => check(`n-${t.key}`, t.label, t.help, p[t.key], (v) => setP({ ...p, [t.key]: v }), !p.enabled))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="n-qs" label="Quiet hours start" error={errors.quiet_hours_start}>
          <Input {...fieldAria("n-qs", errors.quiet_hours_start)} type="time" value={p.quiet_hours_start} onChange={(e) => setP({ ...p, quiet_hours_start: e.target.value })} />
        </Field>
        <Field id="n-qe" label="Quiet hours end" error={errors.quiet_hours_end}>
          <Input {...fieldAria("n-qe", errors.quiet_hours_end)} type="time" value={p.quiet_hours_end} onChange={(e) => setP({ ...p, quiet_hours_end: e.target.value })} />
        </Field>
        <Field id="n-max" label="Max reminders per day" error={errors.max_per_day}>
          <Input {...fieldAria("n-max", errors.max_per_day)} type="number" inputMode="numeric" min="0" max="10" value={p.max_per_day} onChange={(e) => setP({ ...p, max_per_day: e.target.value === "" ? Number.NaN : Number(e.target.value) })} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">Nothing is created during quiet hours, and each topic is sent at most once a day.</p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : null} Save preferences</Button>
        {status ? <p role={status.ok ? "status" : "alert"} className={`text-sm font-medium ${status.ok ? "text-fiber" : "text-destructive"}`}>{status.text}</p> : null}
      </div>
    </form>
  );
}
