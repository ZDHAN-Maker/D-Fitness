/**
 * The "database facts" the model is allowed to talk about, plus the plain-language summary shown to the USER.
 * Both are computed by the server from the user's own data. The model never produces facts: it only comments on them.
 */
import { formatDuration, formatInt, formatWater } from "@/utils/format";
import { formatSigned } from "@/lib/calculations/body";

export type CoachFacts = {
  date: string;
  profile: { experience: string | null; primaryGoal: string | null; activityLevel: string | null; ageYears: number | null; heightCm: number | null };
  targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; water_ml: number; sleep_minutes: number; workouts_per_week: number };
  window: { days: number; from: string; to: string };
  workouts: { count: number; perWeek: number; volumeKg: number; recent: { date: string; name: string }[] };
  nutrition: { daysLogged: number; avgCalories: number; avgProtein: number; avgCarbs: number; avgFat: number; avgFiber: number } | null;
  sleep: { nights: number; avgMinutes: number } | null;
  water: { daysLogged: number; avgMl: number } | null;
  recovery: { avg: number; latest: number | null; latestDate: string | null } | null;
  weight: { latestKg: number; changeKg: number | null; spanDays: number | null } | null;
  today: { calories: number; protein_g: number; waterMl: number; workout: "done" | "in_progress" | "none" };
  goals: { title: string; progressPct: number; current: number | null; target: number; unit: string | null; daysLeft: number | null }[];
  streaks: { workout: number; nutrition: number; hydration: number; habit: number };
  missing: string[];
};

/** Which areas have NO data. Computed here so "data unavailable" never depends on the model noticing. */
export function computeMissing(f: Omit<CoachFacts, "missing">): string[] {
  const m: string[] = [];
  const d = f.window.days;
  if (f.workouts.count === 0) m.push(`Workouts: none finished in the last ${d} days`);
  if (!f.nutrition) m.push(`Nutrition: no food logged in the last ${d} days`);
  if (!f.sleep) m.push(`Sleep: no sleep logged in the last ${d} days`);
  if (!f.water) m.push(`Water: no water logged in the last ${d} days`);
  if (!f.recovery) m.push(`Recovery: no recovery check-ins in the last ${d} days`);
  if (!f.weight) m.push("Body weight: no weight entries");
  if (f.goals.length === 0) m.push("Goals: none set");
  if (!f.profile.experience) m.push("Profile: training experience not set");
  if (!f.profile.primaryGoal) m.push("Profile: main goal not set");
  return m;
}

/** Plain-language lines shown to the user under every AI answer ("Your data used"). */
export function describeFacts(f: CoachFacts): string[] {
  const out: string[] = [];
  const w = f.workouts;
  if (w.count > 0) out.push(`Workouts: ${w.count} in the last ${f.window.days} days (${w.perWeek}/week, target ${f.targets.workouts_per_week}/week), ${formatInt(w.volumeKg)} kg total volume`);
  if (f.nutrition) out.push(`Nutrition: ${formatInt(f.nutrition.avgCalories)} kcal and ${f.nutrition.avgProtein} g protein on average over ${f.nutrition.daysLogged} logged days (targets ${formatInt(f.targets.calories)} kcal / ${f.targets.protein_g} g)`);
  if (f.sleep) out.push(`Sleep: ${formatDuration(f.sleep.avgMinutes)} on average over ${f.sleep.nights} nights (target ${formatDuration(f.targets.sleep_minutes)})`);
  if (f.water) out.push(`Water: ${formatWater(f.water.avgMl)} on average over ${f.water.daysLogged} days (target ${formatWater(f.targets.water_ml)})`);
  if (f.recovery) out.push(`Recovery: average ${f.recovery.avg}/100${f.recovery.latest !== null ? `, latest ${f.recovery.latest}` : ""}`);
  if (f.weight) out.push(`Weight: ${f.weight.latestKg} kg${f.weight.changeKg !== null && f.weight.spanDays ? ` (${formatSigned(f.weight.changeKg)} kg over ${f.weight.spanDays} days)` : ""}`);
  const t = f.today;
  out.push(`Today so far: ${formatInt(t.calories)} kcal, ${Math.round(t.protein_g)} g protein, ${formatWater(t.waterMl)} water, workout ${t.workout === "done" ? "done" : t.workout === "in_progress" ? "in progress" : "not done yet"}`);
  for (const g of f.goals.slice(0, 3)) out.push(`Goal "${g.title}": ${g.progressPct}%${g.daysLeft !== null && g.daysLeft >= 0 ? `, ${g.daysLeft} days left` : ""}`);
  return out;
}

/** The exact JSON the model receives. Names/emails are never included. */
export const factsForModel = (f: CoachFacts) => JSON.stringify(f);
