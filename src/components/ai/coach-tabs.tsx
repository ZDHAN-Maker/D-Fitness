"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/coach", label: "Coach", exact: true },
  { href: "/coach/meal", label: "Meals" },
  { href: "/coach/workout", label: "Workout" },
  { href: "/coach/review", label: "Weekly review" },
  { href: "/coach/scan", label: "Food scanner" },
];

export function CoachTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="AI sections" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-1 rounded-lg bg-muted p-1 md:w-fit">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={cn("flex h-10 items-center rounded-md px-4 text-sm font-medium", active ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
