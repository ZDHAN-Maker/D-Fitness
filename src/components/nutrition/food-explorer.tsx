"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/nutrition/favorite-button";
import { MacroLine } from "@/components/nutrition/macro-line";
import { PortionDialog } from "@/components/nutrition/portion-dialog";
import { MEAL_LABEL, MEAL_ORDER } from "@/features/nutrition/meals";
import type { FoodResult } from "@/features/nutrition/types";
import { formatInt } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { MealType } from "@/types/domain";

type Category = { id: number; name: string };
type Props = { date: string; defaultMeal: MealType; categories: Category[]; recent: FoodResult[]; favorites: FoodResult[]; initialQuery?: string };

const PAGE = 20;

export function FoodExplorer({ date, defaultMeal, categories, recent, favorites, initialQuery = "" }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [tab, setTab] = useState<"recent" | "favorites">("recent");
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [results, setResults] = useState<FoodResult[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<FoodResult | null>(null);
  const [notice, setNotice] = useState<string>();
  const seq = useRef(0);

  const searching = query.trim().length > 0 || categoryId !== null;

  async function fetchPage(offset: number, append: boolean) {
    const id = ++seq.current;
    setLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams({ q: query.trim(), offset: String(offset), limit: String(PAGE) });
      if (categoryId) params.set("category", String(categoryId));
      const res = await fetch(`/api/foods/search?${params}`);
      const json = await res.json();
      if (id !== seq.current) return; // a newer search superseded this one
      if (!res.ok) throw new Error(json?.error?.message ?? "Search failed");
      setResults((prev) => (append ? [...prev, ...json.data.items] : json.data.items));
      setHasMore(json.data.hasMore);
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }

  // Debounced, server-driven search: 300 ms after typing stops.
  useEffect(() => {
    if (!searching) {
      seq.current++;
      setResults([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    const t = setTimeout(() => void fetchPage(0, false), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, categoryId]);

  const list = searching ? results : tab === "recent" ? recent : favorites;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
          <Input type="search" inputMode="search" aria-label="Search foods" placeholder="Search foods, e.g. nasi putih" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="w-40">
          <Select aria-label="Meal" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
            {MEAL_ORDER.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Categories">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={categoryId === c.id}
            onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
            className={cn("h-9 shrink-0 rounded-full border px-3 text-sm font-medium", categoryId === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent")}
          >
            {c.name}
          </button>
        ))}
      </div>

      {notice ? (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-fiber/40 bg-fiber/10 px-3 py-2 text-sm font-medium text-fiber">
          <Check className="size-4" aria-hidden="true" />
          {notice}
          <Link href={`/nutrition?date=${date}`} className="ml-auto underline underline-offset-4">
            View diary
          </Link>
        </p>
      ) : null}

      {!searching ? (
        <div role="tablist" aria-label="Quick lists" className="flex gap-1 rounded-lg bg-muted p-1">
          {(["recent", "favorites"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("h-9 flex-1 rounded-md text-sm font-medium capitalize", tab === t ? "bg-card shadow-sm" : "text-muted-foreground")}>
              {t} ({t === "recent" ? recent.length : favorites.length})
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col divide-y rounded-lg border bg-card" aria-busy={loading}>
        {list.map((f) => (
          <li key={`${f.kind}:${f.id}`} className="flex items-center">
            <button type="button" onClick={() => setSelected(f)} className="flex min-h-16 min-w-0 flex-1 flex-col items-start justify-center gap-0.5 px-4 py-2 text-left hover:bg-accent/50">
              <span className="flex w-full items-center gap-2">
                <span className="truncate font-medium">{f.name}</span>
                {f.kind !== "food" ? <Badge variant="default">{f.kind === "custom" ? "Mine" : "Recipe"}</Badge> : null}
              </span>
              <span className="tabular text-xs text-muted-foreground">
                {f.brand ? `${f.brand} · ` : ""}
                {formatInt(f.summary.nutrition.calories)} kcal / {f.summary.label}
              </span>
              <MacroLine m={f.summary.nutrition} />
            </button>
            <FavoriteButton food={f} initial={Boolean(f.isFavorite)} />
            <button type="button" aria-label={`Add ${f.name}`} onClick={() => setSelected(f)} className="mr-2 grid size-11 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
              <Plus className="size-5" aria-hidden="true" />
            </button>
          </li>
        ))}
        {loading ? (
          <li className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Searching…
          </li>
        ) : null}
        {!loading && list.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">
            {searching ? "No foods match that search. Try another word, or create it under My foods." : tab === "recent" ? "Foods you log will show up here for quick re-adding." : "Tap the star on any food to keep it here."}
          </li>
        ) : null}
      </ul>

      {searching && hasMore && !loading ? (
        <Button variant="outline" onClick={() => void fetchPage(results.length, true)}>
          Show more
        </Button>
      ) : null}

      <PortionDialog
        mode="add"
        food={selected}
        date={date}
        initialMeal={meal}
        onClose={() => setSelected(null)}
        onDone={(msg) => {
          setSelected(null);
          setNotice(msg);
        }}
      />
    </div>
  );
}
