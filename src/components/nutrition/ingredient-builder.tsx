"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { draftNutrition, newDraft } from "@/features/nutrition/drafts";
import type { FoodResult, IngredientDraft } from "@/features/nutrition/types";
import { formatInt } from "@/utils/format";

type Props = { value: IngredientDraft[]; onChange: (next: IngredientDraft[]) => void; allowCustom: boolean; error?: string };

/** Search foods, add them as ingredients, edit amounts/units. Totals are computed by the parent. */
export function IngredientBuilder({ value, onChange, allowCustom, error }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      seq.current++;
      setResults([]);
      return;
    }
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(term)}&limit=8`);
        const json = await res.json();
        if (id !== seq.current) return;
        const items: FoodResult[] = res.ok ? json.data.items : [];
        // Recipes cannot be ingredients; composite custom foods can only appear in recipes.
        setResults(items.filter((i) => i.kind === "food" || (allowCustom && i.kind === "custom")));
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, allowCustom]);

  const update = (i: number, patch: Partial<IngredientDraft>) => onChange(value.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {value.map((d, i) => {
          const n = draftNutrition(d);
          return (
            <li key={`${d.ref.kind}:${d.ref.id}:${i}`} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border bg-card p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.ref.name}</p>
                <p className="tabular text-xs text-muted-foreground">{formatInt(n.calories)} kcal</p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${d.ref.name}`} onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
                <Trash2 />
              </Button>
              <div className="col-span-2 grid grid-cols-[1fr_1.4fr] gap-2">
                <Input
                  aria-label={`Amount of ${d.ref.name}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={Number.isFinite(d.quantity) ? d.quantity : ""}
                  onChange={(e) => update(i, { quantity: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
                />
                <Select aria-label={`Unit for ${d.ref.name}`} value={d.optionKey} onChange={(e) => update(i, { optionKey: e.target.value })}>
                  {d.ref.options.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
        <Input type="search" aria-label="Search for an ingredient" placeholder="Search to add an ingredient…" value={q} onChange={(e) => setQ(e.target.value)} />
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Searching…
          </p>
        ) : null}
        {results.length > 0 ? (
          <ul className="flex max-h-64 flex-col overflow-y-auto rounded-md border bg-card">
            {results.map((f) => (
              <li key={`${f.kind}:${f.id}`}>
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center gap-3 px-3 text-left hover:bg-accent/50"
                  onClick={() => {
                    const d = newDraft(f);
                    if (d) onChange([...value, d]);
                    setQ("");
                    setResults([]);
                  }}
                >
                  <Plus className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
                  <span className="tabular text-xs text-muted-foreground">{formatInt(f.summary.nutrition.calories)} kcal / {f.summary.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
