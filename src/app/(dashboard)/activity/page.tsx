import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { activitySummary, listActivities } from "@/features/activity/service";
import { deleteActivityAction } from "@/features/activity/actions";
import { DeleteButton } from "@/components/ui/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { formatPace } from "@/lib/calculations/workout";
import { formatDuration, formatInt } from "@/utils/format";
import { addDays, startOfWeek, todayInTimeZone } from "@/utils/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  const { profile, settings } = await getProfileAndSettings(user.id);
  const today = todayInTimeZone(profile?.timezone ?? "UTC");
  const weekStart = startOfWeek(today, settings?.week_starts_on ?? 1);
  const page = Math.min(500, Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1));
  const [week, list] = await Promise.all([activitySummary(weekStart, addDays(weekStart, 6)), listActivities(page)]);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  const stat = (label: string, value: string) => (
    <div className="rounded-lg bg-muted p-3 text-center">
      <dd className="tabular text-lg font-semibold">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );

  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold md:text-4xl">Activity</h1>
        <Link href="/activity/new" className={cn(buttonVariants())}><Plus /> Log activity</Link>
      </header>

      <section aria-label="This week">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">This week</h2>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stat("Sessions", String(week.count))}
          {stat("Time", formatDuration(week.minutes))}
          {stat("Distance", `${week.km} km`)}
          {stat("Calories", `${formatInt(week.kcal)} kcal`)}
        </dl>
      </section>

      {list.total === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">No activities yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Log a run, ride, swim or a game of badminton. Runs and rides track distance and pace.</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col divide-y rounded-lg border bg-card">
            {list.items.map((a) => (
              <li key={a.id} className="flex items-center gap-1 py-2 pl-4 pr-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.type_name}</p>
                  <p className="tabular text-xs text-muted-foreground">
                    {a.logged_on} · {formatDuration(a.duration_minutes)}
                    {a.distance_km ? ` · ${a.distance_km} km` : ""}
                    {a.avg_pace_sec_per_km ? ` · ${formatPace(a.avg_pace_sec_per_km)}` : ""}
                    {a.calories_burned ? ` · ${formatInt(a.calories_burned)} kcal` : ""}
                  </p>
                  {a.notes ? <p className="truncate text-xs text-muted-foreground">{a.notes}</p> : null}
                </div>
                <Link href={`/activity/${a.id}`} aria-label={`Edit ${a.type_name} on ${a.logged_on}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}><Pencil /></Link>
                <DeleteButton label={`${a.type_name} on ${a.logged_on}`} action={deleteActivityAction.bind(null, a.id)} />
              </li>
            ))}
          </ul>
          {pages > 1 ? (
            <nav aria-label="Pagination" className="flex items-center justify-between">
              <Link href={`/activity?page=${page - 1}`} aria-disabled={page <= 1} className={cn(buttonVariants({ variant: "outline" }), page <= 1 && "pointer-events-none opacity-40")}>Newer</Link>
              <span className="tabular text-sm text-muted-foreground">Page {page} of {pages}</span>
              <Link href={`/activity?page=${page + 1}`} aria-disabled={page >= pages} className={cn(buttonVariants({ variant: "outline" }), page >= pages && "pointer-events-none opacity-40")}>Older</Link>
            </nav>
          ) : null}
        </>
      )}
      <p className="text-xs text-muted-foreground">Personal bests for activities live under <Link href="/workout/records" className="underline underline-offset-4">Workout → Records</Link>.</p>
    </>
  );
}
