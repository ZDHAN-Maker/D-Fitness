import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { addDays, formatLongDate } from "@/utils/date";
import { cn } from "@/lib/utils";

export function DateNav({ date, today, basePath = "/nutrition" }: { date: string; today: string; basePath?: string }) {
  const isToday = date === today;
  return (
    <div className="flex items-center gap-2">
      <Link href={`${basePath}?date=${addDays(date, -1)}`} aria-label="Previous day" className={cn(buttonVariants({ variant: "outline", size: "icon" }))}>
        <ChevronLeft />
      </Link>
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate font-display text-lg font-semibold">{isToday ? "Today" : formatLongDate(date)}</p>
        {isToday ? <p className="text-xs text-muted-foreground">{formatLongDate(date)}</p> : null}
      </div>
      <Link href={`${basePath}?date=${addDays(date, 1)}`} aria-label="Next day" aria-disabled={date >= today} className={cn(buttonVariants({ variant: "outline", size: "icon" }), date >= today && "pointer-events-none opacity-40")}>
        <ChevronRight />
      </Link>
      {!isToday ? (
        <Link href={basePath} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Today
        </Link>
      ) : null}
    </div>
  );
}
