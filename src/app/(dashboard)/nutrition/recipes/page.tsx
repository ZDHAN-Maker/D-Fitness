import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { FavoriteButton } from "@/components/nutrition/favorite-button";
import { MacroLine } from "@/components/nutrition/macro-line";
import { deleteRecipeAction } from "@/features/nutrition/actions";
import { listRecipes } from "@/features/nutrition/library";
import { getFavoriteKeys } from "@/features/nutrition/refs";
import { formatDecimal, formatInt } from "@/utils/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Recipes" };

export default async function RecipesPage() {
  const [recipes, fav] = await Promise.all([listRecipes(), getFavoriteKeys()]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Combine ingredients once, then log a serving anytime.</p>
        <Link href="/nutrition/recipes/new" className={cn(buttonVariants())}>
          <Plus /> New recipe
        </Link>
      </div>

      {recipes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">No recipes yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Try “My Breakfast”: oatmeal, banana, milk and peanut butter.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border bg-card">
          {recipes.map((r) => (
            <li key={r.id} className="flex items-center gap-1 py-2 pl-4 pr-2">
              <Link href={`/nutrition/log?q=${encodeURIComponent(r.name)}`} className="min-w-0 flex-1 py-1" aria-label={`Log ${r.name}`}>
                <span className="block truncate font-medium">{r.name}</span>
                <span className="tabular block text-xs text-muted-foreground">
                  {formatInt(r.perServing.calories)} kcal per serving · makes {formatDecimal(r.servings)}
                </span>
                <MacroLine m={r.perServing} />
              </Link>
              <FavoriteButton food={{ kind: "recipe", id: r.id }} initial={fav.has(`recipe:${r.id}`)} />
              <Link href={`/nutrition/recipes/${r.id}`} aria-label={`Edit ${r.name}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
                <Pencil />
              </Link>
              <DeleteButton label={r.name} action={deleteRecipeAction.bind(null, r.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
