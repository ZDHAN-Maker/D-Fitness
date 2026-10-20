"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncAppStateAction } from "@/features/notifications/actions";

const KEY = "pfos:last-sync";
const EVERY_MS = 15 * 60 * 1000;

/**
 * Renders nothing. When the app is opened (and again when it becomes visible after 15+ minutes) it refreshes
 * goals / streaks / achievements and asks the server whether any contextual notification applies right now.
 * Throttled so it never runs more than once per 15 minutes; failures are silent.
 */
export function NotificationSync() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const last = Number(localStorage.getItem(KEY) ?? 0);
        if (Date.now() - last < EVERY_MS) return;
        localStorage.setItem(KEY, String(Date.now()));
      } catch {
        /* storage unavailable: run anyway */
      }
      const res = await syncAppStateAction();
      if (!cancelled && res.ok && res.data.changed) router.refresh();
    };
    void run();
    const onVisible = () => document.visibilityState === "visible" && void run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
  return null;
}
