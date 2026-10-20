import Link from "next/link";
import type { RangeKey } from "@/lib/validations/body";
import { cn } from "@/lib/utils";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "180d", label: "6 months" },
  { key: "1y", label: "1 year" },
  { key: "all", label: "All" },
];

export function RangeTabs({ basePath, active, extra = "" }: { basePath: string; active: RangeKey; extra?: string }) {
  return (
    <nav aria-label="Time range" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-1 rounded-lg bg-muted p-1">
        {RANGES.map((r) => (
          <li key={r.key}>
            <Link href={`${basePath}?range=${r.key}${extra}`} aria-current={active === r.key ? "true" : undefined} className={cn("flex h-9 items-center rounded-md px-3 text-sm font-medium", active === r.key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {r.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
