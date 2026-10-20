import { Award, Droplets, Dumbbell, Flame, Footprints, Moon, Trophy, Utensils, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { dumbbell: Dumbbell, flame: Flame, trophy: Trophy, footprints: Footprints, utensils: Utensils, droplets: Droplets, moon: Moon };

export function AchievementIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || Award;
  return <Icon className={className} aria-hidden="true" />;
}
