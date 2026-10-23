"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV_ITEMS, isAvailable } from "@/constants/navigation";
import { signOutAction } from "@/features/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pfos:sidebar-collapsed";

/**
 * Desktop/tablet navigation.
 * "auto" (no stored preference): icon rail on tablet (md), full sidebar from lg.
 * The toggle overrides that and the choice is remembered.
 */
export function Sidebar({ displayName, unread = 0 }: { displayName: string; unread?: number }) {
  const pathname = usePathname();
  const [pref, setPref] = useState<"auto" | "collapsed" | "expanded">("auto");

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "collapsed" || v === "expanded") setPref(v);
    } catch {
      /* storage unavailable: stay on auto */
    }
  }, []);

  const toggle = () => {
    const isCollapsedNow = pref === "collapsed" || (pref === "auto" && window.innerWidth < 1024);
    const next = isCollapsedNow ? "expanded" : "collapsed";
    setPref(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const widthClass = pref === "collapsed" ? "w-[4.5rem]" : pref === "expanded" ? "w-64" : "w-[4.5rem] lg:w-64";
  const labelClass = pref === "collapsed" ? "hidden" : pref === "expanded" ? "inline" : "hidden lg:inline";

  return (
    <aside className={cn("sticky top-0 hidden h-screen max-h-screen shrink-0 flex-col border-r bg-card py-4 transition-[width] duration-200 md:flex", widthClass)}>
      <div className="flex items-center gap-2 px-4 pb-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary font-display text-sm font-bold text-primary-foreground">OS</span>
        <span className={cn("truncate font-display text-base font-bold", labelClass)}>Fitness OS</span>
      </div>

      <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const inner = (
              <>
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className={cn("truncate", labelClass)}>{item.label}</span>
                {item.href === "/notifications" && unread > 0 ? (
                  <span className={cn("ml-auto rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground", labelClass)} aria-label={`${unread} unread`}>{unread > 99 ? "99+" : unread}</span>
                ) : null}
                {!isAvailable(item) ? (
                  <span className={cn("ml-auto rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground", labelClass)}>P{item.phase}</span>
                ) : null}
              </>
            );
            return (
              <li key={item.href}>
                {isAvailable(item) ? (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                      active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    {inner}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    title={`${item.label} — coming in phase ${item.phase}`}
                    className="flex h-11 cursor-not-allowed items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground/60"
                  >
                    {inner}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-1 border-t px-3 pt-3">
        <p className={cn("truncate px-3 text-sm font-medium", labelClass)}>{displayName}</p>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action={signOutAction}>
            <Button variant="ghost" size="icon" type="submit" aria-label="Sign out" title="Sign out">
              <LogOut />
            </Button>
          </form>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle sidebar width" className="ml-auto">
            {pref === "collapsed" ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
      </div>
    </aside>
  );
}
