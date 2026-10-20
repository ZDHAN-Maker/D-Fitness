const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export const formatInt = (n: number) => nf0.format(n);
export const formatDecimal = (n: number) => nf1.format(n);

/** 1800 -> "1.8 L", 450 -> "450 ml" */
export function formatWater(ml: number): string {
  return ml >= 1000 ? `${nf1.format(ml / 1000)} L` : `${nf0.format(ml)} ml`;
}

/** 444 -> "7h 24m" */
export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then a short date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const secs = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(secs)) return "";
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const d = Math.round(hours / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}
