import type { Metadata } from "next";
import { Check, Lock } from "lucide-react";
import { AchievementIcon } from "@/components/achievements/achievement-icon";
import { StreakCards } from "@/components/achievements/streak-cards";
import { ProgressBar } from "@/components/ui/progress-bar";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { trySyncProgress } from "@/features/goals/service";
import { listAchievements, listStreaks } from "@/features/achievements/service";
import { formatLongDate, todayInTimeZone } from "@/utils/date";
import { formatDecimal } from "@/utils/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Achievements" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function AchievementsPage() {
  const user = await requireUser();
  const { profile } = await getProfileAndSettings(user.id);
  const today = todayInTimeZone(profile?.timezone ?? "UTC");
  await trySyncProgress(today); // unlocking happens server-side; this page can only display it
  const [achievements, streaks] = await Promise.all([listAchievements(), listStreaks(today)]);

  const unlocked = achievements.filter((a) => a.unlockedAt).length;
  const categories = [...new Set(achievements.map((a) => a.category ?? "other"))];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold md:text-4xl">Achievements</h1>
        <p className="mt-1 text-sm text-muted-foreground">{unlocked} of {achievements.length} unlocked</p>
      </header>

      <section aria-labelledby="streaks-h" className="flex flex-col gap-3">
        <h2 id="streaks-h" className="text-lg font-semibold">Streaks</h2>
        <StreakCards streaks={streaks} />
      </section>

      {categories.map((c) => (
        <section key={c} aria-label={cap(c)} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{cap(c)}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {achievements.filter((a) => (a.category ?? "other") === c).map((a) => {
              const done = Boolean(a.unlockedAt);
              return (
                <li key={a.id} className={cn("flex gap-3 rounded-lg border bg-card p-4", !done && "opacity-80")}>
                  <span className={cn("grid size-12 shrink-0 place-items-center rounded-full", done ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
                    <AchievementIcon name={a.icon} className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-semibold">
                      {a.name}
                      {done ? <Check className="size-4 text-fiber" aria-label="Unlocked" /> : <Lock className="size-3.5 text-muted-foreground" aria-label="Locked" />}
                    </p>
                    <p className="text-sm text-muted-foreground">{a.description}</p>
                    {done ? (
                      <p className="mt-1 text-xs text-fiber">Unlocked {formatLongDate(String(a.unlockedAt).slice(0, 10))}</p>
                    ) : (
                      <div className="mt-2">
                        <ProgressBar value={Math.min(a.current, a.threshold)} max={a.threshold} label={`${a.name} progress`} />
                        <p className="tabular mt-1 text-xs text-muted-foreground">{formatDecimal(Math.min(a.current, a.threshold))} / {formatDecimal(a.threshold)}</p>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
