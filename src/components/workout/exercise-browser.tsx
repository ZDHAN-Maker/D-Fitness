"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ExerciseFacets } from "@/features/workout/exercises";
import type { Exercise } from "@/types/domain";

const PAGE = 24;
type Props = {
  facets: ExerciseFacets;
  categories: { id: number; name: string }[];
  /** When set, rows are buttons that pick the exercise (builder / active workout). Otherwise rows link to the detail page. */
  onSelect?: (e: Exercise) => void;
  initialQuery?: string;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ExerciseBrowser({ facets, categories, onSelect, initialQuery = "" }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [category, setCategory] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [movement, setMovement] = useState("");
  const [items, setItems] = useState<Exercise[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const seq = useRef(0);

  async function load(offset: number, append: boolean) {
    const id = ++seq.current;
    setLoading(true);
    setError(undefined);
    try {
      const p = new URLSearchParams({ offset: String(offset), limit: String(PAGE) });
      if (q.trim()) p.set("q", q.trim());
      if (category) p.set("category", category);
      if (muscle) p.set("muscle", muscle);
      if (equipment) p.set("equipment", equipment);
      if (difficulty) p.set("difficulty", difficulty);
      if (movement) p.set("movement", movement);
      const res = await fetch(`/api/exercises?${p}`);
      const json = await res.json();
      if (id !== seq.current) return;
      if (!res.ok) throw new Error(json?.error?.message ?? "Could not load exercises");
      setItems((prev) => (append ? [...prev, ...json.data.items] : json.data.items));
      setHasMore(json.data.hasMore);
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : "Could not load exercises");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void load(0, false), q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, muscle, equipment, difficulty, movement]);

  const filters = [
    { label: "Muscle", value: muscle, set: setMuscle, options: facets.muscles },
    { label: "Equipment", value: equipment, set: setEquipment, options: facets.equipment },
    { label: "Difficulty", value: difficulty, set: setDifficulty, options: facets.difficulties },
    { label: "Movement", value: movement, set: setMovement, options: facets.movements },
  ];
  const activeFilters = [category, muscle, equipment, difficulty, movement].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
        <Input type="search" inputMode="search" aria-label="Search exercises" placeholder="Search exercises, e.g. bench press" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {filters.map((f) => (
          <Select key={f.label} aria-label={f.label} value={f.value} onChange={(e) => f.set(e.target.value)}>
            <option value="">{f.label}: any</option>
            {f.options.map((o) => (
              <option key={o} value={o}>
                {cap(o)}
              </option>
            ))}
          </Select>
        ))}
      </div>
      {activeFilters > 0 ? (
        <button type="button" className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline" onClick={() => { setCategory(""); setMuscle(""); setEquipment(""); setDifficulty(""); setMovement(""); }}>
          Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col divide-y rounded-lg border bg-card" aria-busy={loading}>
        {items.map((e) => {
          const body = (
            <>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                <span className="truncate font-medium">{e.name}</span>
                <span className="truncate text-xs text-muted-foreground">{[e.primary_muscle, e.equipment].filter(Boolean).map((x) => cap(x as string)).join(" · ")}</span>
              </span>
              {e.difficulty ? <Badge variant="muted">{cap(e.difficulty)}</Badge> : null}
              {onSelect ? <Plus className="size-5 shrink-0 text-primary" aria-hidden="true" /> : <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
            </>
          );
          return (
            <li key={e.id}>
              {onSelect ? (
                <button type="button" onClick={() => onSelect(e)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 hover:bg-accent/50" aria-label={`Add ${e.name}`}>
                  {body}
                </button>
              ) : (
                <Link href={`/workout/exercises/${e.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-accent/50">
                  {body}
                </Link>
              )}
            </li>
          );
        })}
        {loading ? (
          <li className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading…
          </li>
        ) : null}
        {!loading && items.length === 0 ? <li className="p-6 text-center text-sm text-muted-foreground">No exercises match. Try fewer filters or a different word.</li> : null}
      </ul>

      {hasMore && !loading ? (
        <Button variant="outline" onClick={() => void load(items.length, true)}>
          Show more
        </Button>
      ) : null}
    </div>
  );
}
