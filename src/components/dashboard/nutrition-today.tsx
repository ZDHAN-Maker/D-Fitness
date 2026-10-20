import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { calculateRemaining } from "@/lib/calculations/progress";
import { formatInt } from "@/utils/format";
import type { MacroNutrients, UserSettings } from "@/types/domain";

export type NutritionTargets = Pick<UserSettings, "calorie_target" | "protein_target_g" | "carbs_target_g" | "fat_target_g" | "fiber_target_g">;

const MACROS = [
  { key: "protein_g", target: "protein_target_g", label: "Protein", color: "bg-protein" },
  { key: "carbs_g", target: "carbs_target_g", label: "Carbs", color: "bg-carbs" },
  { key: "fat_g", target: "fat_target_g", label: "Fat", color: "bg-fat" },
  { key: "fiber_g", target: "fiber_target_g", label: "Fibre", color: "bg-fiber" },
] as const;

export function NutritionToday({ nutrition, targets, title = "Calories" }: { nutrition: MacroNutrients & { items_count: number }; targets: NutritionTargets; title?: string }) {
  const remaining = calculateRemaining(nutrition.calories, targets.calorie_target);
  const over = Math.max(0, nutrition.calories - targets.calorie_target);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div>
          <p className="tabular font-display text-5xl font-bold leading-none">
            {formatInt(nutrition.calories)}
            <span className="ml-2 text-lg font-medium text-muted-foreground">/ {formatInt(targets.calorie_target)} kcal</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {nutrition.items_count === 0
              ? "No food logged yet today."
              : over > 0
                ? `${formatInt(over)} kcal over target`
                : `${formatInt(remaining)} kcal remaining`}
          </p>
          <ProgressBar className="mt-3" value={nutrition.calories} max={targets.calorie_target} label="Calories today" />
        </div>

        <dl className="grid gap-3">
          {MACROS.map((m) => {
            const value = nutrition[m.key];
            const target = targets[m.target];
            return (
              <div key={m.key} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3">
                <dt className="text-sm font-medium">{m.label}</dt>
                <ProgressBar value={value} max={target} colorClass={m.color} label={`${m.label} today`} />
                <dd className="tabular text-right text-sm text-muted-foreground">
                  {formatInt(value)} / {formatInt(target)} g
                </dd>
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}
