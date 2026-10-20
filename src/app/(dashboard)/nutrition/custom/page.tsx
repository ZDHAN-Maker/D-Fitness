import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/ui/delete-button";
import { FavoriteButton } from "@/components/nutrition/favorite-button";
import { MacroLine } from "@/components/nutrition/macro-line";
import { deleteCustomFoodAction } from "@/features/nutrition/actions";
import { listCustomFoods } from "@/features/nutrition/library";
import { getFavoriteKeys } from "@/features/nutrition/refs";
import { formatInt } from "@/utils/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My foods" };

export default async function CustomFoodsPage() {
  const [foods, fav] = await Promise.all([listCustomFoods(), getFavoriteKeys()]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Foods and meals you defined. Only you can see them.</p>
        <Link href="/nutrition/custom/new" className={cn(buttonVariants())}>
          <Plus /> New food
        </Link>
      </div>

      {foods.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">No custom foods yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create a meal you eat often, like “Indomie + 2 eggs + sausage”, and log it in one tap.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border bg-card">
          {foods.map((f) => (
            <li key={f.id} className="flex items-center gap-1 py-2 pl-4 pr-2">
              <Link href={`/nutrition/log?q=${encodeURIComponent(f.name)}`} className="min-w-0 flex-1 py-1" aria-label={`Log ${f.name}`}>
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{f.name}</span>
                  {f.is_composite ? <Badge>Meal</Badge> : null}
                </span>
                <span className="tabular block text-xs text-muted-foreground">
                  {formatInt(f.calories)} kcal / {f.is_composite ? "portion" : `${f.base_quantity} ${f.base_unit}`}
                </span>
                <MacroLine m={f} />
              </Link>
              <FavoriteButton food={{ kind: "custom", id: f.id }} initial={fav.has(`custom:${f.id}`)} />
              <Link href={`/nutrition/custom/${f.id}`} aria-label={`Edit ${f.name}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
                <Pencil />
              </Link>
              <DeleteButton label={f.name} action={deleteCustomFoodAction.bind(null, f.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
