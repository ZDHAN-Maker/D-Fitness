import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  Droplets,
  Dumbbell,
  HeartPulse,
  LayoutDashboard,
  Scale,
  Settings,
  Sparkles,
  Target,
  Trophy,
  Utensils,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Build phase in which the module ships. Items from later phases render disabled. */
  phase: number;
};

/** Highest phase that is implemented. Bump as phases ship. */
export const CURRENT_PHASE = 6;

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, phase: 1 },
  { href: "/nutrition", label: "Nutrition", icon: Utensils, phase: 2 },
  { href: "/workout", label: "Workout", icon: Dumbbell, phase: 3 },
  { href: "/activity", label: "Activity", icon: Activity, phase: 3 },
  { href: "/body", label: "Body", icon: Scale, phase: 4 },
  { href: "/recovery", label: "Recovery", icon: HeartPulse, phase: 4 },
  { href: "/hydration", label: "Hydration", icon: Droplets, phase: 4 },
  { href: "/goals", label: "Goals", icon: Target, phase: 5 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, phase: 5 },
  { href: "/analytics", label: "Analytics", icon: BarChart3, phase: 5 },
  { href: "/achievements", label: "Achievements", icon: Trophy, phase: 5 },
  { href: "/notifications", label: "Notifications", icon: Bell, phase: 5 },
  { href: "/coach", label: "AI Coach", icon: Sparkles, phase: 6 },
  { href: "/settings", label: "Settings", icon: Settings, phase: 1 },
];

export const isAvailable = (item: { phase: number }) => item.phase <= CURRENT_PHASE;

/** Items shown directly in the mobile bottom bar. */
export const MOBILE_PRIMARY = ["/dashboard", "/nutrition", "/workout", "/settings"] as const;

export type QuickAction = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  phase: number;
};

/** The five one-hand actions from the product brief. */
export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Add food", description: "Log a meal or snack", href: "/nutrition/log", icon: Utensils, phase: 2 },
  { label: "Start workout", description: "Begin a session", href: "/workout/start", icon: Dumbbell, phase: 3 },
  { label: "Add water", description: "250 ml, 500 ml and more", href: "/hydration", icon: Droplets, phase: 4 },
  { label: "Log weight", description: "Record today's weight", href: "/body/weight", icon: Scale, phase: 4 },
  { label: "Start activity", description: "Run, ride, swim and more", href: "/activity/new", icon: Activity, phase: 3 },
];

/** Every path prefix that requires a signed-in user (middleware enforces this). */
export const PROTECTED_PREFIXES: string[] = NAV_ITEMS.map((i) => i.href);
export const AUTH_ROUTES = ["/login", "/register"];
