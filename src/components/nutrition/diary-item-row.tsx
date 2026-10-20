"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { MacroLine } from "@/components/nutrition/macro-line";
import { PortionDialog } from "@/components/nutrition/portion-dialog";
import { deleteLogItemAction } from "@/features/nutrition/actions";
import { matchStoredOption } from "@/lib/calculations/nutrition";
import type { DiaryItem } from "@/features/nutrition/types";
import { formatDecimal, formatInt } from "@/utils/format";
import type { MealType } from "@/types/domain";

export function DiaryItemRow({ item, meal }: { item: DiaryItem; meal: MealType }) {
  const [editing, setEditing] = useState(false);
  const stored = item.ref ? matchStoredOption(item.ref.options, item.unit_code, item.quantity, item.base_amount) : undefined;

  return (
    <li className="flex items-center gap-2 px-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name_snapshot}</p>
        <p className="tabular text-xs text-muted-foreground">
          {formatDecimal(item.quantity)} {stored?.label ?? item.unit_code} · {formatDecimal(item.base_amount)} {item.ref?.per.base_unit ?? "g"}
        </p>
        <MacroLine m={item} />
      </div>
      <span className="tabular w-16 shrink-0 text-right text-sm font-semibold">{formatInt(item.calories)}</span>
      {item.ref && stored ? (
        <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${item.name_snapshot}`} onClick={() => setEditing(true)}>
          <Pencil />
        </Button>
      ) : null}
      <DeleteButton label={item.name_snapshot} action={() => deleteLogItemAction(item.id)} />
      {editing && item.ref && stored ? (
        <PortionDialog
          mode="edit"
          food={item.ref}
          itemId={item.id}
          initialMeal={meal}
          initial={{ quantity: item.quantity, optionKey: stored.key }}
          onClose={() => setEditing(false)}
          onDone={() => setEditing(false)}
        />
      ) : null}
    </li>
  );
}
