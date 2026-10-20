import Link from "next/link";
import { RANGE_DAYS, type AnalyticsRange } from "@/lib/calculations/analytics";
import { cn } from "@/lib/utils";

export type AnalyticsTab = "workout" | "nutrition" | "lifestyle";
const TABS: { key: AnalyticsTab; label: string }[] = [
  { key: "workout", label: "Workout" },
  { key: "nutrition", label: "Nutrition" },
  { key: "lifestyle", label: "Lifestyle" },
];
const RANGES = Object.keys(RANGE_DAYS) as AnalyticsRange[];
const RANGE_LABEL: Record<AnalyticsRange, string> = { "30d": "30 days", "90d": "90 days", "180d": "6 months" };

export function AnalyticsNav({ tab, range }: { tab: AnalyticsTab; range: AnalyticsRange }) {
  const pill = (active: boolean) => cn("flex h-10 items-center rounded-md px-4 text-sm font-medium", active ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Analytics sections" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-1 rounded-lg bg-muted p-1">
          {TABS.map((t) => <li key={t.key}><Link href={`/analytics?tab=${t.key}&range=${range}`} aria-current={tab === t.key ? "page" : undefined} className={pill(tab === t.key)}>{t.label}</Link></li>)}
        </ul>
      </nav>
      <nav aria-label="Time range">
        <ul className="flex gap-1 rounded-lg bg-muted p-1">
          {RANGES.map((r) => <li key={r}><Link href={`/analytics?tab=${tab}&range=${r}`} aria-current={range === r ? "true" : undefined} className={cn(pill(range === r), "h-9 px-3")}>{RANGE_LABEL[r]}</Link></li>)}
        </ul>
      </nav>
    </div>
  );
}
