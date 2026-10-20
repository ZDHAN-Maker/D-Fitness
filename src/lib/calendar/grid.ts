import { addDays, startOfWeek } from "@/utils/date";

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMonthKey = (v: unknown): v is string => typeof v === "string" && MONTH_RE.test(v);

export const monthOf = (isoDate: string) => isoDate.slice(0, 7);
export const firstOfMonth = (ym: string) => `${ym}-01`;

export function lastOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0, 12)).toISOString().slice(0, 10); // day 0 of next month = last day of this one
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type GridCell = { date: string; inMonth: boolean };

/** Full weeks covering the month, starting on `weekStartsOn` (0 = Sunday, 1 = Monday). */
export function buildMonthGrid(ym: string, weekStartsOn = 1): GridCell[][] {
  const first = firstOfMonth(ym);
  const last = lastOfMonth(ym);
  const weeks: GridCell[][] = [];
  for (let start = startOfWeek(first, weekStartsOn); start <= last; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => ({ date: addDays(start, i), inMonth: monthOf(addDays(start, i)) === ym })));
  }
  return weeks;
}

export const weekdayLabels = (weekStartsOn = 1) => {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return Array.from({ length: 7 }, (_, i) => names[(weekStartsOn + i) % 7]!);
};
