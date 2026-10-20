import type { Metadata } from "next";
import Link from "next/link";
import { listHistory } from "@/features/workout/sessions";
import { deleteSessionAction } from "@/features/workout/actions";
import { DeleteButton } from "@/components/ui/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { formatDuration, formatInt } from "@/utils/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Workout history" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.min(500, Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1));
  const h = await listHistory(page);
  const pages = Math.max(1, Math.ceil(h.total / h.pageSize));

  if (h.total === 0) {
    return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No finished workouts yet. Complete one and it appears here.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{h.total} workout{h.total === 1 ? "" : "s"} logged</p>
      <ul className="flex flex-col divide-y rounded-lg border bg-card">
        {h.items.map((s) => (
          <li key={s.id} className="flex items-center gap-1 py-1 pl-4 pr-2">
            <Link href={`/workout/session/${s.id}`} className="min-w-0 flex-1 py-2">
              <span className="block truncate font-medium">{s.name}</span>
              <span className="tabular block text-xs text-muted-foreground">
                {s.logged_on} · {s.exercise_count} exercises
                {s.total_volume_kg ? ` · ${formatInt(s.total_volume_kg)} kg` : ""}
                {s.ended_at ? ` · ${formatDuration((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)}` : ""}
              </span>
            </Link>
            <DeleteButton label={s.name} action={deleteSessionAction.bind(null, s.id)} />
          </li>
        ))}
      </ul>
      {pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between">
          <Link href={`/workout/history?page=${page - 1}`} aria-disabled={page <= 1} className={cn(buttonVariants({ variant: "outline" }), page <= 1 && "pointer-events-none opacity-40")}>Newer</Link>
          <span className="tabular text-sm text-muted-foreground">Page {page} of {pages}</span>
          <Link href={`/workout/history?page=${page + 1}`} aria-disabled={page >= pages} className={cn(buttonVariants({ variant: "outline" }), page >= pages && "pointer-events-none opacity-40")}>Older</Link>
        </nav>
      ) : null}
    </div>
  );
}
