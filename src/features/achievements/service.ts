import { createClient } from "@/lib/supabase/server";
import { effectiveStreak, type StreakState } from "@/lib/calculations/goals";

type Row = Record<string, unknown>;

export type AchievementItem = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  threshold: number;
  current: number;
  unlockedAt: string | null;
};

export async function listAchievements(): Promise<AchievementItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("achievement_progress");
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({
    id: Number(r.id),
    code: String(r.code),
    name: String(r.name),
    description: (r.description as string) ?? null,
    category: (r.category as string) ?? null,
    icon: (r.icon as string) ?? null,
    threshold: Number(r.threshold),
    current: Number(r.current_value),
    unlockedAt: (r.unlocked_at as string) ?? null,
  }));
}

export type StreakItem = { type: "workout" | "nutrition" | "hydration" | "habit"; current: number; longest: number; state: StreakState };

const ORDER: StreakItem["type"][] = ["workout", "nutrition", "hydration", "habit"];

export async function listStreaks(today: string): Promise<StreakItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("streaks").select("streak_type, current_count, longest_count, last_activity_date");
  if (error) throw error;
  const rows = new Map((data ?? []).map((r) => [r.streak_type as StreakItem["type"], r]));
  return ORDER.map((type) => {
    const r = rows.get(type);
    const e = effectiveStreak(r ? { current_count: Number(r.current_count), longest_count: Number(r.longest_count), last_activity_date: r.last_activity_date ? String(r.last_activity_date).slice(0, 10) : null } : undefined, today);
    return { type, ...e };
  });
}
