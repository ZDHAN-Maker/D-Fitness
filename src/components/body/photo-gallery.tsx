"use client";

/* eslint-disable @next/next/no-img-element --
   Private, short-lived signed URLs: routing them through the image optimiser would copy private
   photos into a shared cache. Files are already resized to <= 1600 px before upload. */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { deletePhotoAction } from "@/features/body/actions";
import type { PhotoEntry } from "@/features/body/service";
import { formatLongDate } from "@/utils/date";
import { cn } from "@/lib/utils";

const POSE: Record<string, string> = { front: "Front", side: "Side", back: "Back", other: "Other" };

export function PhotoGallery({ photos }: { photos: PhotoEntry[] }) {
  const router = useRouter();
  const [compare, setCompare] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const refreshed = useRef(false);

  // Signed URLs expire after an hour; if one fails, ask the server for fresh ones (once).
  const onImgError = () => {
    if (!refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  };

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 2 ? [p[1]!, id] : [...p, id]));
  const [a, b] = picked.map((id) => photos.find((p) => p.id === id)).sort((x, y) => (x && y ? x.takenOn.localeCompare(y.takenOn) : 0));

  if (photos.length === 0) {
    return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No progress photos yet. Add your first one above; comparing front photos a few weeks apart is the most useful.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{photos.length} photo{photos.length === 1 ? "" : "s"} · private to you</p>
        {photos.length >= 2 ? (
          <Button type="button" variant={compare ? "secondary" : "outline"} size="sm" aria-pressed={compare} onClick={() => { setCompare((c) => !c); setPicked([]); }}>
            <GitCompare /> Compare
          </Button>
        ) : null}
      </div>

      {compare ? (
        <div className="rounded-lg border bg-card p-3">
          <p className="mb-2 text-sm text-muted-foreground">{picked.length < 2 ? `Select ${2 - picked.length} more photo${picked.length === 1 ? "" : "s"} to compare.` : "Oldest on the left."}</p>
          {a && b ? (
            <div className="grid grid-cols-2 gap-2">
              {[a, b].map((p) =>
                p ? (
                  <figure key={p.id} className="m-0">
                    {p.url ? <img src={p.url} alt={`${POSE[p.pose]} photo from ${p.takenOn}`} className="w-full rounded-md object-cover" onError={onImgError} /> : null}
                    <figcaption className="mt-1 text-center text-xs text-muted-foreground">{p.takenOn}</figcaption>
                  </figure>
                ) : null,
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p) => {
          const selected = picked.includes(p.id);
          return (
            <li key={p.id} className={cn("overflow-hidden rounded-lg border bg-card", selected && "ring-2 ring-primary")}>
              <button type="button" disabled={!compare} onClick={() => toggle(p.id)} aria-pressed={compare ? selected : undefined} aria-label={`${POSE[p.pose]} photo, ${formatLongDate(p.takenOn)}`} className="block w-full disabled:cursor-default">
                {p.url ? <img src={p.url} alt={`${POSE[p.pose]} progress photo from ${p.takenOn}`} loading="lazy" decoding="async" className="aspect-[3/4] w-full object-cover" onError={onImgError} /> : <div className="grid aspect-[3/4] place-items-center bg-muted text-xs text-muted-foreground">Unavailable</div>}
              </button>
              <div className="flex items-center justify-between gap-1 px-3 py-2">
                <div className="min-w-0">
                  <p className="tabular text-sm font-medium">{p.takenOn}</p>
                  <p className="truncate text-xs text-muted-foreground">{POSE[p.pose]}{p.note ? ` · ${p.note}` : ""}</p>
                </div>
                <DeleteButton label={`photo from ${p.takenOn}`} action={deletePhotoAction.bind(null, p.id)} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
