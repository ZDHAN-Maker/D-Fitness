"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { updateSettingsAction } from "@/features/profile/actions";
import { settingsSchema, type SettingsInput } from "@/lib/validations/settings";

/** Empty input -> undefined (optional), otherwise a number. */
const num = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : Number(v));

export function SettingsForm({ defaults, timeZones }: { defaults: SettingsInput; timeZones: string[] }) {
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string }>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsInput>({ resolver: zodResolver(settingsSchema), defaultValues: defaults });

  const onSubmit = handleSubmit((values) => {
    setStatus(undefined);
    startTransition(async () => {
      const res = await updateSettingsAction(values);
      setStatus(res.ok ? { kind: "ok", text: "Settings saved." } : { kind: "error", text: res.error });
    });
  });

  const n = { setValueAs: num } as const;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Used for greetings, calorie estimates and AI coaching context.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="displayName" label="Name" error={errors.displayName?.message}>
            <Input {...fieldAria("displayName", errors.displayName?.message)} autoComplete="name" {...register("displayName")} />
          </Field>
          <Field id="timezone" label="Time zone" error={errors.timezone?.message} hint="Decides when your day starts and ends.">
            <Select {...fieldAria("timezone", errors.timezone?.message, "hint")} {...register("timezone")}>
              {timeZones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="birthDate" label="Birth date" error={errors.birthDate?.message}>
            <Input {...fieldAria("birthDate", errors.birthDate?.message)} type="date" autoComplete="bday" {...register("birthDate")} />
          </Field>
          <Field id="sex" label="Sex" error={errors.sex?.message}>
            <Select {...fieldAria("sex", errors.sex?.message)} {...register("sex")}>
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </Field>
          <Field id="heightCm" label="Height (cm)" error={errors.heightCm?.message}>
            <Input {...fieldAria("heightCm", errors.heightCm?.message)} type="number" inputMode="decimal" step="0.1" {...register("heightCm", n)} />
          </Field>
          <Field id="activityLevel" label="Daily activity" error={errors.activityLevel?.message}>
            <Select {...fieldAria("activityLevel", errors.activityLevel?.message)} {...register("activityLevel")}>
              <option value="">Not set</option>
              <option value="sedentary">Mostly sitting</option>
              <option value="light">Light movement</option>
              <option value="moderate">Moderately active</option>
              <option value="active">Active</option>
              <option value="very_active">Very active</option>
            </Select>
          </Field>
          <Field id="experienceLevel" label="Training experience" error={errors.experienceLevel?.message}>
            <Select {...fieldAria("experienceLevel", errors.experienceLevel?.message)} {...register("experienceLevel")}>
              <option value="">Not set</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Select>
          </Field>
          <Field id="primaryGoal" label="Main goal" error={errors.primaryGoal?.message}>
            <Select {...fieldAria("primaryGoal", errors.primaryGoal?.message)} {...register("primaryGoal")}>
              <option value="">Not set</option>
              <option value="lose_fat">Lose fat</option>
              <option value="build_muscle">Build muscle</option>
              <option value="maintain">Maintain</option>
              <option value="improve_endurance">Improve endurance</option>
              <option value="general_health">General health</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily targets</CardTitle>
          <CardDescription>The dashboard, reminders and AI suggestions compare your day against these.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="calorieTarget" label="Calories (kcal)" error={errors.calorieTarget?.message} hint="Minimum 1,200 kcal.">
            <Input {...fieldAria("calorieTarget", errors.calorieTarget?.message, "hint")} type="number" inputMode="numeric" {...register("calorieTarget", n)} />
          </Field>
          <Field id="proteinTargetG" label="Protein (g)" error={errors.proteinTargetG?.message}>
            <Input {...fieldAria("proteinTargetG", errors.proteinTargetG?.message)} type="number" inputMode="numeric" {...register("proteinTargetG", n)} />
          </Field>
          <Field id="carbsTargetG" label="Carbs (g)" error={errors.carbsTargetG?.message}>
            <Input {...fieldAria("carbsTargetG", errors.carbsTargetG?.message)} type="number" inputMode="numeric" {...register("carbsTargetG", n)} />
          </Field>
          <Field id="fatTargetG" label="Fat (g)" error={errors.fatTargetG?.message}>
            <Input {...fieldAria("fatTargetG", errors.fatTargetG?.message)} type="number" inputMode="numeric" {...register("fatTargetG", n)} />
          </Field>
          <Field id="fiberTargetG" label="Fibre (g)" error={errors.fiberTargetG?.message}>
            <Input {...fieldAria("fiberTargetG", errors.fiberTargetG?.message)} type="number" inputMode="numeric" {...register("fiberTargetG", n)} />
          </Field>
          <Field id="waterTargetMl" label="Water (ml)" error={errors.waterTargetMl?.message}>
            <Input {...fieldAria("waterTargetMl", errors.waterTargetMl?.message)} type="number" inputMode="numeric" step="50" {...register("waterTargetMl", n)} />
          </Field>
          <Field id="sleepTargetHours" label="Sleep (hours)" error={errors.sleepTargetHours?.message}>
            <Input {...fieldAria("sleepTargetHours", errors.sleepTargetHours?.message)} type="number" inputMode="decimal" step="0.25" {...register("sleepTargetHours", n)} />
          </Field>
          <Field id="weeklyWorkoutTarget" label="Workouts per week" error={errors.weeklyWorkoutTarget?.message}>
            <Input {...fieldAria("weeklyWorkoutTarget", errors.weeklyWorkoutTarget?.message)} type="number" inputMode="numeric" {...register("weeklyWorkoutTarget", n)} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save changes
        </Button>
        {status ? (
          <p role={status.kind === "error" ? "alert" : "status"} className={status.kind === "error" ? "text-sm font-medium text-destructive" : "text-sm font-medium text-fiber"}>
            {status.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
