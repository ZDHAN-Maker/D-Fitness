"use client";

/* eslint-disable @next/next/no-img-element --
   Both images are local object URLs of the photo the user just picked (a preview), not remote images to optimise. */

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Camera, Check, Loader2, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { postAi } from "@/components/ai/ai-client";
import { confirmScanAction, discardScanAction } from "@/features/ai/actions";
import { MEAL_LABEL, MEAL_ORDER } from "@/features/nutrition/meals";
import { refKey, type FoodResult } from "@/features/nutrition/types";
import type { ScanResult } from "@/features/ai/scan";
import { calculateMacroTotals, calculateNutrition } from "@/lib/calculations/nutrition";
import { compressImage } from "@/lib/images/compress";
import { buildPhotoPath } from "@/lib/images/photo";
import { createClient } from "@/lib/supabase/client";
import { formatDecimal, formatInt } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { MealType } from "@/types/domain";

type Row = { name: string; confidence: number; preparation: string; candidates: FoodResult[]; selected: string; amount: string };
type Stage = "idle" | "preparing" | "uploading" | "analyzing" | "review" | "done";

const SKIP = "skip";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Photo -> AI guesses -> matched to YOUR food database -> you review and confirm. Nothing is logged until you confirm. */
export function FoodScan({ userId, date, defaultMeal, disabled }: { userId: string; date: string; defaultMeal: MealType; disabled: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string>();
  const [scan, setScan] = useState<{ id: string; notes: string; isFood: boolean }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [saving, startSave] = useTransition();
  const [searchQ, setSearchQ] = useState<Record<number, string>>({});

  const pick = (f: File | undefined) => {
    if (preview) URL.revokeObjectURL(preview);
    setError(undefined);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : undefined);
  };

  const analyze = async () => {
    if (!file) return;
    setError(undefined);
    const supabase = createClient();
    let path: string | undefined;
    try {
      setStage("preparing");
      const blob = await compressImage(file, 0.82);
      setStage("uploading");
      path = buildPhotoPath(userId, crypto.randomUUID(), "image/jpeg");
      const { error: upErr } = await supabase.storage.from("food-scans").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error("The upload failed. Check your connection and try again.");
      setStage("analyzing");
      const res = await postAi<ScanResult>("/api/ai/food-scan", { path });
      if (!res.ok) throw new Error(res.error);
      if (!res.data.isFood || res.data.items.length === 0) {
        setStage("idle");
        return setError(res.data.notes || "I could not find any food in that photo. Try a closer, well-lit shot from above.");
      }
      setScan({ id: res.data.scanId, notes: res.data.notes, isFood: true });
      setRows(res.data.items.map((i) => ({ name: i.name, confidence: i.confidence, preparation: i.preparation, candidates: i.candidates, selected: i.candidates[0] ? refKey(i.candidates[0]) : SKIP, amount: String(i.estimatedGrams) })));
      setStage("review");
    } catch (e) {
      if (path) void supabase.storage.from("food-scans").remove([path]);
      setStage("idle");
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  };

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const search = async (i: number) => {
    const q = (searchQ[i] ?? "").trim();
    if (!q) return;
    const res = await fetch(`/api/foods/search?q=${encodeURIComponent(q)}&limit=5`);
    const json = await res.json().catch(() => null);
    const found: FoodResult[] = res.ok ? (json?.data?.items ?? []) : [];
    if (!found.length) return setError(`No foods match "${q}".`);
    setError(undefined);
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, candidates: [...found.filter((f) => !x.candidates.some((c) => refKey(c) === refKey(f))), ...x.candidates].slice(0, 8), selected: refKey(found[0]!) } : x)));
    setSearchQ((s) => ({ ...s, [i]: "" }));
  };

  const chosen = rows.map((r) => {
    const food = r.selected === SKIP ? undefined : r.candidates.find((c) => refKey(c) === r.selected);
    const amount = Number(r.amount);
    const ok = Boolean(food) && Number.isFinite(amount) && amount > 0 && amount <= 3000;
    return { food, amount, ok, nutrition: food && ok ? calculateNutrition(food.per, amount) : null };
  });
  const keep = chosen.filter((c) => c.ok);
  const totals = calculateMacroTotals(keep.flatMap((c) => (c.nutrition ? [c.nutrition] : [])));
  const invalid = chosen.some((c, i) => rows[i]!.selected !== SKIP && !c.ok);

  const confirm = () => {
    if (!scan || keep.length === 0 || invalid) return;
    setError(undefined);
    startSave(async () => {
      const res = await confirmScanAction({ scanId: scan.id, date, mealType: meal, items: keep.map((c) => ({ kind: c.food!.kind, id: c.food!.id, amount: c.amount })) });
      if (!res.ok) return setError(res.error);
      setStage("done");
    });
  };

  const discard = async () => {
    if (scan) await discardScanAction(scan.id);
    setScan(undefined);
    setRows([]);
    pick(undefined);
    setStage("idle");
    if (fileRef.current) fileRef.current.value = "";
  };

  if (stage === "done") {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-lg border bg-card p-8 text-center">
        <Check className="size-10 text-fiber" aria-hidden="true" />
        <p className="font-display text-xl font-semibold">Added to your {MEAL_LABEL[meal].toLowerCase()}</p>
        <p className="text-sm text-muted-foreground">The photo was deleted. Only the foods you confirmed were saved.</p>
        <div className="flex gap-3"><Link href={`/nutrition?date=${date}`} className="text-sm font-medium text-primary underline underline-offset-4">View diary</Link><button type="button" className="text-sm font-medium text-primary underline underline-offset-4" onClick={() => { setStage("idle"); setScan(undefined); setRows([]); pick(undefined); }}>Scan another meal</button></div>
      </div>
    );
  }

  const busy = stage === "preparing" || stage === "uploading" || stage === "analyzing";
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Take or upload a photo of your meal. The AI guesses what it is, the app matches it to your food database, and <strong className="text-foreground">you check everything before it is logged</strong>. Portion sizes from photos are rough estimates.</p>

      {stage !== "review" ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          <input ref={fileRef} id="scan-file" type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" className="sr-only" disabled={disabled || busy} onChange={(e) => pick(e.target.files?.[0])} />
          <label htmlFor="scan-file" className={cn("flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center hover:bg-accent/40", (disabled || busy) && "pointer-events-none opacity-60")}>
            {preview ? (
              <img src={preview} alt="Selected meal" className="max-h-64 rounded-md object-contain" />
            ) : (<><Camera className="size-8 text-muted-foreground" aria-hidden="true" /><span className="text-sm font-medium">Take or choose a photo of your meal</span><span className="text-xs text-muted-foreground">Stored privately and deleted after you confirm or discard</span></>)}
          </label>
          <Button type="button" onClick={analyze} disabled={!file || busy || disabled}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {stage === "preparing" ? "Preparing photo…" : stage === "uploading" ? "Uploading…" : stage === "analyzing" ? "Analysing…" : "Analyse photo"}
          </Button>
        </div>
      ) : null}

      {error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {stage === "review" && scan ? (
        <section aria-label="Review detected foods" className="flex flex-col gap-3">
          {preview ? <img src={preview} alt="Your meal" className="max-h-40 w-fit rounded-md border object-contain" /> : null}
          {scan.notes ? <p className="rounded-md bg-muted p-3 text-sm"><strong>Double-check:</strong> {scan.notes}</p> : null}

          <ul className="flex flex-col gap-3">
            {rows.map((r, i) => {
              const c = chosen[i]!;
              return (
                <li key={i} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{cap(r.name)}</p>
                    {r.confidence < 0.5 ? <Badge variant="muted">Low confidence</Badge> : null}
                    {r.preparation ? <span className="text-xs text-muted-foreground">{r.preparation}</span> : null}
                  </div>

                  <fieldset className="mt-2">
                    <legend className="sr-only">Match for {r.name}</legend>
                    <ul className="flex flex-col gap-1">
                      {r.candidates.map((f) => (
                        <li key={refKey(f)}>
                          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-accent/50">
                            <input type="radio" name={`m-${i}`} className="size-4 accent-[hsl(var(--primary))]" checked={r.selected === refKey(f)} onChange={() => update(i, { selected: refKey(f) })} />
                            <span className="min-w-0 flex-1 truncate text-sm">{f.name}{f.kind !== "food" ? ` (${f.kind === "custom" ? "mine" : "recipe"})` : ""}</span>
                            <span className="tabular text-xs text-muted-foreground">{formatInt(f.summary.nutrition.calories)} kcal / {f.summary.label}</span>
                          </label>
                        </li>
                      ))}
                      <li>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-accent/50">
                          <input type="radio" name={`m-${i}`} className="size-4 accent-[hsl(var(--primary))]" checked={r.selected === SKIP} onChange={() => update(i, { selected: SKIP })} />
                          <span className="text-sm text-muted-foreground">{r.candidates.length ? "None of these: skip this item" : "No match found: skip, or search below"}</span>
                        </label>
                      </li>
                    </ul>
                  </fieldset>

                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`amt-${i}`} className="text-xs font-medium">Amount ({c.food?.per.base_unit ?? "g"})</label>
                      <Input id={`amt-${i}`} className="w-28" type="number" inputMode="decimal" min="1" max="3000" step="5" value={r.amount} onChange={(e) => update(i, { amount: e.target.value })} disabled={r.selected === SKIP} aria-invalid={r.selected !== SKIP && !c.ok} />
                    </div>
                    {c.nutrition ? <p className="tabular pb-2 text-sm"><strong>{formatInt(c.nutrition.calories)} kcal</strong> <span className="text-muted-foreground">· P {formatDecimal(c.nutrition.protein_g)} · C {formatDecimal(c.nutrition.carbs_g)} · F {formatDecimal(c.nutrition.fat_g)} g</span></p> : null}
                    <div className="ml-auto flex items-end gap-1">
                      <Input aria-label={`Search another food for ${r.name}`} className="w-40" placeholder="Search another food" value={searchQ[i] ?? ""} onChange={(e) => setSearchQ((s) => ({ ...s, [i]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(i); } }} />
                      <Button type="button" variant="outline" size="icon" aria-label="Search" onClick={() => void search(i)}><Search /></Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="rounded-lg bg-muted p-4">
            <p className="tabular font-display text-2xl font-bold leading-none">{formatInt(totals.calories)} <span className="text-sm font-medium text-muted-foreground">kcal · {keep.length} item{keep.length === 1 ? "" : "s"}</span></p>
            <p className="tabular mt-1 text-sm text-muted-foreground">Protein {formatDecimal(totals.protein_g)} g · Carbs {formatDecimal(totals.carbs_g)} g · Fat {formatDecimal(totals.fat_g)} g</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium">Meal
              <Select className="w-36" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>{MEAL_ORDER.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}</Select>
            </label>
            <Button type="button" onClick={confirm} disabled={saving || keep.length === 0 || invalid}>{saving ? <Loader2 className="animate-spin" /> : <Check />} Confirm and add to diary</Button>
            <Button type="button" variant="ghost" onClick={() => void discard()} disabled={saving}>Discard</Button>
          </div>
          {invalid ? <p className="text-xs font-medium text-destructive">Enter an amount between 1 and 3000 for every item you keep.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
