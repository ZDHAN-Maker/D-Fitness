"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleFavoriteAction } from "@/features/nutrition/actions";
import type { FoodRef } from "@/features/nutrition/types";
import { cn } from "@/lib/utils";

export function FavoriteButton({ food, initial, className }: { food: FoodRef; initial: boolean; className?: string }) {
  const [fav, setFav] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={fav}
      aria-label={fav ? "Remove from favourites" : "Add to favourites"}
      onClick={(e) => {
        e.stopPropagation();
        const next = !fav;
        setFav(next); // optimistic
        startTransition(async () => {
          const res = await toggleFavoriteAction({ kind: food.kind, id: food.id });
          if (!res.ok) setFav(!next);
          else setFav(res.data.isFavorite);
        });
      }}
      className={cn("grid size-11 shrink-0 place-items-center rounded-md hover:bg-accent", className)}
    >
      <Star className={cn("size-5", fav ? "fill-carbs text-carbs" : "text-muted-foreground")} aria-hidden="true" />
    </button>
  );
}
