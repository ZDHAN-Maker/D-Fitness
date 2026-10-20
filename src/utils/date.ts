/** Today as YYYY-MM-DD in the given IANA time zone (the user-local "logical day"). */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  try {
    // The en-CA locale formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function hourInTimeZone(timeZone: string, now: Date = new Date()): number {
  try {
    const h = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(now);
    return Number(h) % 24;
  } catch {
    return now.getUTCHours();
  }
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "2026-10-08" -> "Thursday, October 8" */
export function formatLongDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(date);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "2026-10-08" + 1 -> "2026-10-09" (calendar arithmetic, no time-zone drift). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days, 12));
  return dt.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday for a YYYY-MM-DD calendar date. */
export function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12)).getUTCDay();
}

/** First day of the week containing `isoDate`. weekStartsOn: 0 = Sunday, 1 = Monday ... */
export function startOfWeek(isoDate: string, weekStartsOn = 1): string {
  const diff = (weekdayOf(isoDate) - weekStartsOn + 7) % 7;
  return addDays(isoDate, -diff);
}

/** Minutes since local midnight in the given time zone (0–1439). */
export function minutesInTimeZone(timeZone: string, now: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return h * 60 + m;
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}
