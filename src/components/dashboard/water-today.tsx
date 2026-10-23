import { Droplets } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { calculateWaterProgress } from "@/lib/calculations/progress";
import { WaterQuickAdd } from "@/components/hydration/water-quick-add";
import { formatWater } from "@/utils/format";

export function WaterToday({ currentMl, targetMl, date }: { currentMl: number; targetMl: number; date: string }) {
  const p = calculateWaterProgress(currentMl, targetMl);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Water</CardTitle>
        <Droplets className="size-5 text-water" aria-hidden="true" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="tabular font-display text-3xl font-bold leading-none sm:text-4xl">
          {formatWater(p.currentMl)}
          <span className="ml-2 text-sm font-medium text-muted-foreground sm:text-base">/ {formatWater(p.targetMl)}</span>
        </p>
        <ProgressBar value={p.currentMl} max={p.targetMl} colorClass="bg-water" label="Water today" />
        <p className="text-sm text-muted-foreground">{p.remainingMl > 0 ? `${formatWater(p.remainingMl)} to go` : "Target reached"}</p>
        <WaterQuickAdd compact date={date} totalMl={currentMl} targetMl={targetMl} />
      </CardContent>
    </Card>
  );
}
