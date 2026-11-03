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
  const [p, setP] = useState<NotificationPrefs>({
    workout_time: "07:00",
    nutrition_time: "17:00",
    hydration_time: "14:00",
    min_sleep_hours: 6.0,
    min_streak_days: 3,
    ...initial,
  });
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
      setStatus(res.ok ? { ok: true, text: "Pengaturan berhasil disimpan." } : { ok: false, text: res.error });
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
      <div>
        <h2 className="font-display text-lg font-semibold">Pengaturan Notifikasi Manual</h2>
        <p className="text-xs text-muted-foreground">Sesuaikan kapan dan kategori apa saja yang ingin diingatkan ke HP Anda.</p>
      </div>

      {check("n-enabled", "Aktifkan Semua Notifikasi", "Nyalakan atau matikan semua jenis notifikasi secara global.", p.enabled, (v) => setP({ ...p, enabled: v }))}

      <div className="flex flex-col divide-y border-y">
        {TOGGLES.map((t) => check(`n-${t.key}`, t.label, t.help, p[t.key], (v) => setP({ ...p, [t.key]: v }), !p.enabled))}
      </div>

      {/* Jadwal Jam Pengingat Spesifik */}
      <div className="flex flex-col gap-3 pt-1">
        <h3 className="text-sm font-semibold text-foreground">Jadwal Jam Pengingat Spesifik</h3>
        <p className="text-xs text-muted-foreground -mt-2">
          Atur jam berapa sistem harus mulai mengecek dan mengirimkan notifikasi ke HP Anda.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="n-wt" label="Jam Pengingat Latihan" error={errors.workout_time}>
            <Input
              {...fieldAria("n-wt", errors.workout_time)}
              type="time"
              disabled={!p.enabled || !p.workout_reminders}
              value={p.workout_time ?? "07:00"}
              onChange={(e) => setP({ ...p, workout_time: e.target.value })}
            />
          </Field>
          <Field id="n-nt" label="Jam Cek Protein / Makan" error={errors.nutrition_time}>
            <Input
              {...fieldAria("n-nt", errors.nutrition_time)}
              type="time"
              disabled={!p.enabled || !p.nutrition_reminders}
              value={p.nutrition_time ?? "17:00"}
              onChange={(e) => setP({ ...p, nutrition_time: e.target.value })}
            />
          </Field>
          <Field id="n-ht" label="Jam Cek Minum Air" error={errors.hydration_time}>
            <Input
              {...fieldAria("n-ht", errors.hydration_time)}
              type="time"
              disabled={!p.enabled || !p.hydration_reminders}
              value={p.hydration_time ?? "14:00"}
              onChange={(e) => setP({ ...p, hydration_time: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 pt-1">
          <Field id="n-ms" label="Batas Minimal Tidur (Jam)" error={errors.min_sleep_hours}>
            <Input
              {...fieldAria("n-ms", errors.min_sleep_hours)}
              type="number"
              step="0.5"
              min="4"
              max="12"
              disabled={!p.enabled || !p.recovery_alerts}
              value={p.min_sleep_hours ?? 6}
              onChange={(e) => setP({ ...p, min_sleep_hours: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
            />
          </Field>
          <Field id="n-stk" label="Minimal Streak Beruntun (Hari)" error={errors.min_streak_days}>
            <Input
              {...fieldAria("n-stk", errors.min_streak_days)}
              type="number"
              min="1"
              max="30"
              disabled={!p.enabled || !p.workout_reminders}
              value={p.min_streak_days ?? 3}
              onChange={(e) => setP({ ...p, min_streak_days: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
            />
          </Field>
        </div>
      </div>

      {/* Jam Tenang & Batas Harian */}
      <div className="flex flex-col gap-3 pt-2 border-t">
        <h3 className="text-sm font-semibold text-foreground">Jam Tenang & Batas Pengiriman</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="n-qs" label="Jam Tenang Mulai" error={errors.quiet_hours_start}>
            <Input
              {...fieldAria("n-qs", errors.quiet_hours_start)}
              type="time"
              disabled={!p.enabled}
              value={p.quiet_hours_start}
              onChange={(e) => setP({ ...p, quiet_hours_start: e.target.value })}
            />
          </Field>
          <Field id="n-qe" label="Jam Tenang Selesai" error={errors.quiet_hours_end}>
            <Input
              {...fieldAria("n-qe", errors.quiet_hours_end)}
              type="time"
              disabled={!p.enabled}
              value={p.quiet_hours_end}
              onChange={(e) => setP({ ...p, quiet_hours_end: e.target.value })}
            />
          </Field>
          <Field id="n-max" label="Maksimal Notifikasi / Hari" error={errors.max_per_day}>
            <Input
              {...fieldAria("n-max", errors.max_per_day)}
              type="number"
              inputMode="numeric"
              min="0"
              max="10"
              disabled={!p.enabled}
              value={p.max_per_day}
              onChange={(e) => setP({ ...p, max_per_day: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
            />
          </Field>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Tidak ada notifikasi yang dikirimkan selama jam tenang tidur, dan setiap topik pengingat hanya dikirim maksimal 1 kali sehari.
      </p>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending} className="cursor-pointer">
          {pending ? <Loader2 className="animate-spin mr-1.5 size-4" /> : null} Simpan Pengaturan
        </Button>
        {status ? (
          <p role={status.ok ? "status" : "alert"} className={`text-sm font-medium ${status.ok ? "text-emerald-400" : "text-destructive"}`}>
            {status.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
