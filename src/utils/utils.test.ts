import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";
import { greetingForHour, todayInTimeZone } from "./date";
import { formatDuration, formatWater } from "./format";

describe("safeRedirectPath", () => {
  it("accepts relative paths", () => expect(safeRedirectPath("/workout?x=1")).toBe("/workout?x=1"));
  it("rejects absolute URLs", () => expect(safeRedirectPath("https://evil.example")).toBe("/dashboard"));
  it("rejects protocol-relative URLs", () => expect(safeRedirectPath("//evil.example")).toBe("/dashboard"));
  it("rejects backslash tricks", () => expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard"));
  it("falls back when empty", () => expect(safeRedirectPath(null)).toBe("/dashboard"));
});

describe("todayInTimeZone", () => {
  const instant = new Date("2026-10-07T20:30:00Z");
  it("uses the user time zone for the logical day", () => {
    expect(todayInTimeZone("Asia/Jakarta", instant)).toBe("2026-10-08"); // UTC+7 => already the 8th
    expect(todayInTimeZone("America/New_York", instant)).toBe("2026-10-07");
  });
  it("falls back for an invalid zone", () => expect(todayInTimeZone("Nope/Zone", instant)).toBe("2026-10-07"));
});

describe("formatters", () => {
  it("formats water", () => {
    expect(formatWater(1800)).toBe("1.8 L");
    expect(formatWater(450)).toBe("450 ml");
  });
  it("formats duration", () => expect(formatDuration(444)).toBe("7h 24m"));
  it("greets by hour", () => expect(greetingForHour(8)).toBe("Good morning"));
});

import { addDays, startOfWeek, weekdayOf } from "./date";

describe("calendar helpers", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("finds the weekday", () => expect(weekdayOf("2026-10-08")).toBe(4)); // Thursday
  it("finds the start of the week (Monday and Sunday starts)", () => {
    expect(startOfWeek("2026-10-08", 1)).toBe("2026-10-05");
    expect(startOfWeek("2026-10-08", 0)).toBe("2026-10-04");
    expect(startOfWeek("2026-10-05", 1)).toBe("2026-10-05");
    expect(startOfWeek("2026-10-04", 1)).toBe("2026-09-28");
  });
});

import { timeAgo } from "./format";

describe("timeAgo", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  it("describes recent times", () => {
    expect(timeAgo("2026-10-08T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-10-08T11:55:00Z", now)).toBe("5 min ago");
    expect(timeAgo("2026-10-08T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-10-06T12:00:00Z", now)).toBe("2 days ago");
    expect(timeAgo("2026-10-07T12:00:00Z", now)).toBe("1 day ago");
    expect(timeAgo("2026-10-07T13:00:00Z", now)).toBe("23 h ago");
  });
  it("falls back to a date after a week and survives bad input", () => {
    expect(timeAgo("2026-09-20T12:00:00Z", now)).toBe("Sep 20");
    expect(timeAgo("not a date", now)).toBe("");
  });
});
