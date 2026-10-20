"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScaleInput } from "@/components/recovery/scale-input";
import { clearDayAction, saveCheckInAction } from "@/features/recovery/actions";
import { splitMinutes, toMinutes } from "@/lib/calculations/body";
import { checkInSchema } from "@/lib/validations/body";

export type CheckInInitial = { sleepMinutes: number | null; sleepQuality?: number; energy?: number; stress?: number; soreness?: number; overall?: number };

export function CheckInForm({ date, initial, hasData }: { date: string; initial: CheckInInitial; hasData: boolean }) {
  const start = initial.sleepMinutes ? splitMinutes(initial.sleepMinutes) : null;
  const [hours, setHours] = useState(start ? String(start.hours) : "");
  const [mins, setMins] = useState(start ? String(start.minutes) : "");
  const [sleepQuality, setSleepQuality] = useState(initial.sleepQuality);
  const [energy, setEnergy] = useState(initial.energy);
  const [stress, setStress] = useState(initial.stress);
  const [soreness, setSoreness] = useState(initial.soreness);
  const [overall, setOverall] = useState(initial.overall);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(undefined);
    const sleepTyped = hours.trim() !== "" || mins.trim() !== "";
    const minutes = sleepTyped ? toMinutes(hours.trim() === "" ? 0 : Number(hours), mins.trim() === "" ? 0 : Number(mins)) : null;
    if (sleepTyped && minutes === null) return setErrors({ sleep: "Enter hours (0–24) and minutes (0–59)." });

    const payload = {
      date,
      sleep: minutes ? { durationMinutes: minutes, quality: sleepQuality } : undefined,
      recovery: { energy, stress, soreness, overall },
    };
    const parsed = checkInSchema.safeParse(payload);
    if (!parsed.success) return setErrors({ form: parsed.error.issues[0]?.message ?? "Check your answers." });
    setErrors({});
    startTransition(async () => {
      const res = await saveCheckInAction(payload);
      setStatus(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6 rounded-lg border bg-card p-4">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-display text-lg font-semibold">Sleep</legend>
        <p className="-mt-2 text-sm text-muted-foreground">How long did you sleep last night?</p>
        <div className="grid max-w-xs grid-cols-2 gap-3">
          <Field id="sleep-h" label="Hours" error={errors.sleep}>
            <Input {...fieldAria("sleep-h", errors.sleep)} type="number" inputMode="numeric" min="0" max="24" value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
          <Field id="sleep-m" label="Minutes">
            <Input {...fieldAria("sleep-m")} type="number" inputMode="numeric" min="0" max="59" step="5" value={mins} onChange={(e) => setMins(e.target.value)} />
          </Field>
        </div>
        <ScaleInput id="sleep-quality" label="Sleep quality" low="poor" high="great" value={sleepQuality} onChange={setSleepQuality} />
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-1 font-display text-lg font-semibold">How do you feel?</legend>
        <ScaleInput id="energy" label="Energy" low="drained" high="energised" value={energy} onChange={setEnergy} />
        <ScaleInput id="stress" label="Stress" low="calm" high="very stressed" value={stress} onChange={setStress} />
        <ScaleInput id="soreness" label="Muscle soreness" low="fresh" high="very sore" value={soreness} onChange={setSoreness} />
        <ScaleInput id="overall" label="Overall" low="bad" high="great" value={overall} onChange={setOverall} />
      </fieldset>

      {errors.form ? <p role="alert" className="text-sm font-medium text-destructive">{errors.form}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save check-in
        </Button>
        {hasData ? <DeleteButton label="this day's sleep and check-in" verb="Clear" action={() => clearDayAction(date)} /> : null}
        {status ? <p role={status.ok ? "status" : "alert"} className={`text-sm font-medium ${status.ok ? "text-fiber" : "text-destructive"}`}>{status.text}</p> : null}
      </div>
    </form>
  );
}
