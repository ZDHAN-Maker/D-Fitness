"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Droplets, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { addWaterAction, undoWaterAction } from "@/features/hydration/actions";
import { calculateWaterProgress } from "@/lib/calculations/progress";
import { formatWater } from "@/utils/format";

const PRESETS = [250, 500, 750, 1000];

type Props = { date: string; totalMl: number; targetMl: number; compact?: boolean };

/** One-thumb water logging: big preset buttons, optimistic total, undo. `compact` = the dashboard version. */
export function WaterQuickAdd({ date, totalMl, targetMl, compact = false }: Props) {
  const [total, setTotal] = useState(totalMl);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    setTotal(totalMl);
  }, [totalMl]);

  const add = (ml: number) => {
    setError(undefined);
    setNote(undefined);
    const before = total;
    setTotal(before + ml); // optimistic
    startTransition(async () => {
      const res = await addWaterAction({ date, amountMl: ml });
      if (!res.ok) {
        setTotal(before);
        return setError(res.error);
      }
      setTotal(res.data.totalMl);
      if (res.data.reached && before < res.data.targetMl) setNote("Daily target reached. Nice work!");
    });
  };

  const undo = () => {
    setError(undefined);
    setNote(undefined);
    startTransition(async () => {
      const res = await undoWaterAction(date);
      if (!res.ok) setError(res.error);
    });
  };

  const p = calculateWaterProgress(total, targetMl);
  const customMl = Number(custom);
  const customOk = Number.isInteger(customMl) && customMl > 0 && customMl <= 5000;

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.slice(0, 2).map((ml) => (
            <Button key={ml} type="button" variant="secondary" size="sm" disabled={pending} onClick={() => add(ml)} aria-label={`Add ${ml} millilitres of water`}>
              + {ml} ml
            </Button>
          ))}
          <Link href="/hydration" className="ml-auto text-sm font-medium text-primary underline-offset-4 hover:underline">More</Link>
        </div>
        {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
        {note ? <p role="status" className="text-xs font-medium text-fiber">{note}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Today</p>
          <Droplets className="size-5 text-water" aria-hidden="true" />
        </div>
        <p className="tabular mt-1 font-display text-5xl font-bold leading-none" aria-live="polite">
          {formatWater(p.currentMl)}
          <span className="ml-2 text-xl font-medium text-muted-foreground">/ {formatWater(p.targetMl)}</span>
        </p>
        <ProgressBar className="mt-4 h-3" value={p.currentMl} max={p.targetMl} colorClass="bg-water" label="Water today" />
        <p className="mt-2 text-sm text-muted-foreground">{p.remainingMl > 0 ? `${formatWater(p.remainingMl)} remaining` : "Target reached"}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label="Add water">
        {PRESETS.map((ml) => (
          <Button key={ml} type="button" size="lg" className="h-16 flex-col gap-0 text-lg" disabled={pending} onClick={() => add(ml)} aria-label={`Add ${ml} millilitres`}>
            <span className="tabular font-bold">{ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`}</span>
          </Button>
        ))}
      </div>

      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (customOk) { add(customMl); setCustom(""); } }}>
        <div className="flex-1">
          <label htmlFor="custom-ml" className="text-sm font-medium">Other amount (ml)</label>
          <Input id="custom-ml" type="number" inputMode="numeric" min="1" max="5000" step="10" value={custom} onChange={(e) => setCustom(e.target.value)} aria-invalid={custom !== "" && !customOk} className="mt-1.5" />
        </div>
        <Button type="submit" variant="secondary" disabled={!customOk || pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Add
        </Button>
        <Button type="button" variant="outline" disabled={pending || total === 0} onClick={undo} aria-label="Undo the last entry">
          <Undo2 /> Undo
        </Button>
      </form>

      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {note ? <p role="status" className="text-sm font-medium text-fiber">{note}</p> : null}
    </div>
  );
}
