import Link from "next/link";
import { Bell } from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Responsive frame.
 *  mobile  : compact top bar + bottom navigation
 *  tablet  : collapsible icon rail
 *  desktop : full sidebar, pages may add a right-hand contextual panel
 */
export function AppShell({ displayName, unreadCount = 0, children }: { displayName: string; unreadCount?: number; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:flex">
      <Sidebar displayName={displayName} unread={unreadCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-b bg-background/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2 font-display text-base font-bold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-extrabold text-primary-foreground shadow-sm">OS</span>
            Fitness OS
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/notifications"
              className="relative grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
            >
              <Bell className="size-5" />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
              ) : null}
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-8">
          {children}
        </main>
      </div>
      <MobileNav unread={unreadCount} />
    </div>
  );
}
