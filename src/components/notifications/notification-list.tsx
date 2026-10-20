"use client";

import { useState, useTransition } from "react";
import { Bell, CalendarClock, Check, Droplets, Flame, HeartPulse, Target, Trophy, Utensils, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteNotificationAction, markAllReadAction, markReadAction } from "@/features/notifications/actions";
import type { NotificationItem } from "@/features/notifications/service";
import { timeAgo } from "@/utils/format";
import { cn } from "@/lib/utils";

const ICON: Record<string, LucideIcon> = { workout_reminder: CalendarClock, protein_gap: Utensils, hydration: Droplets, recovery: HeartPulse, streak_risk: Flame, goal_due: Target, goal_done: Target, achievement: Trophy };

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const unread = items.filter((i) => !i.readAt).length;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(undefined);
      const res = await fn();
      if (!res.ok) setError(res.error);
    });

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <Bell className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 font-medium">You&apos;re all caught up</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Reminders appear only when they are useful: a scheduled workout, a protein gap in the evening, a short night. Never more than your daily limit.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{unread} unread</p>
        <Button type="button" variant="outline" size="sm" disabled={pending || unread === 0} onClick={() => run(() => markAllReadAction())}>Mark all read</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      <ul className="flex flex-col divide-y rounded-lg border bg-card">
        {items.map((n) => {
          const Icon = ICON[n.type] ?? Bell;
          const isUnread = !n.readAt;
          return (
            <li key={n.id} className={cn("flex items-start gap-3 py-3 pl-4 pr-2", isUnread && "bg-accent/40")}>
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><Icon className="size-4" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", isUnread ? "font-semibold" : "font-medium")}>
                  {isUnread ? <span className="mr-1.5 inline-block size-2 rounded-full bg-primary align-middle" role="img" aria-label="Unread" /> : null}
                  {n.title}
                </p>
                {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
              </div>
              {isUnread ? (
                <Button type="button" variant="ghost" size="icon" disabled={pending} aria-label={`Mark "${n.title}" as read`} onClick={() => run(() => markReadAction(n.id))}><Check /></Button>
              ) : null}
              <Button type="button" variant="ghost" size="icon" disabled={pending} aria-label={`Dismiss "${n.title}"`} onClick={() => run(() => deleteNotificationAction(n.id))}><X /></Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
