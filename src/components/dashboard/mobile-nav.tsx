"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, LogOut, Plus } from "lucide-react";
import { MOBILE_PRIMARY, NAV_ITEMS, isAvailable } from "@/constants/navigation";
import { signOutAction } from "@/features/auth/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { QuickActionsList } from "@/components/dashboard/quick-actions-list";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Thumb-reach bottom bar. The centre "+" opens the five quick actions. */
export function MobileNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState<"quick" | "more" | null>(null);
  const close = () => setSheet(null);

  const primary = MOBILE_PRIMARY.map((href) => NAV_ITEMS.find((i) => i.href === href)).filter((i): i is (typeof NAV_ITEMS)[number] => Boolean(i));
  const secondary = NAV_ITEMS.filter((i) => !MOBILE_PRIMARY.includes(i.href as (typeof MOBILE_PRIMARY)[number]));

  const tab = (item: (typeof NAV_ITEMS)[number]) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    const cls = "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium";
    return isAvailable(item) ? (
      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(cls, active ? "text-primary" : "text-muted-foreground")}>
        <Icon className="size-5" aria-hidden="true" />
        {item.label}
      </Link>
    ) : (
      <span key={item.href} aria-disabled="true" className={cn(cls, "text-muted-foreground/50")}>
        <Icon className="size-5" aria-hidden="true" />
        {item.label}
      </span>
    );
  };

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {primary.slice(0, 2).map(tab)}
        <div className="flex flex-1 justify-center">
          <Button size="icon" className="-mt-5 size-14 rounded-full shadow-lg" onClick={() => setSheet("quick")} aria-label="Quick add">
            <Plus className="!size-6" />
          </Button>
        </div>
        {primary.slice(2, 3).map(tab)}
        <button type="button" onClick={() => setSheet("more")} className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground">
          <span className="relative">
            <Ellipsis className="size-5" aria-hidden="true" />
            {unread > 0 ? <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary" role="img" aria-label={`${unread} unread notifications`} /> : null}
          </span>
          More
        </button>
      </nav>

      <BottomSheet open={sheet === "quick"} onClose={close} title="Quick add">
        <QuickActionsList onNavigate={close} />
      </BottomSheet>

      <BottomSheet open={sheet === "more"} onClose={close} title="More">
        <ul className="flex max-h-[60dvh] flex-col gap-1 overflow-y-auto">
          {[...secondary, ...primary.slice(3)].map((item) => {
            const Icon = item.icon;
            const row = (
              <>
                <Icon className="size-5" aria-hidden="true" />
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                {item.href === "/notifications" && unread > 0 ? <Badge>{unread > 99 ? "99+" : unread} new</Badge> : null}
                {!isAvailable(item) ? <Badge variant="muted">Phase {item.phase}</Badge> : null}
              </>
            );
            return (
              <li key={item.href}>
                {isAvailable(item) ? (
                  <Link href={item.href} onClick={close} className="flex min-h-12 items-center gap-3 rounded-md px-2 hover:bg-accent">
                    {row}
                  </Link>
                ) : (
                  <div aria-disabled="true" className="flex min-h-12 items-center gap-3 rounded-md px-2 opacity-60">
                    {row}
                  </div>
                )}
              </li>
            );
          })}
          <li>
            <form action={signOutAction}>
              <button type="submit" className="flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-destructive hover:bg-accent">
                <LogOut className="size-5" aria-hidden="true" />
                <span className="text-sm font-medium">Sign out</span>
              </button>
            </form>
          </li>
        </ul>
      </BottomSheet>
    </>
  );
}
