"use client";

import { useId, useState } from "react";
import { Activity, Dumbbell, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  primaryMuscle?: string | null;
  secondaryMuscles?: string[] | null;
  equipment?: string | null;
  movementType?: string | null;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  defaultView?: "heatmap" | "studio3d";
};

export type MuscleGroup =
  | "chest"
  | "lats"
  | "traps"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "obliques"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "cardio"
  | "full-body";

export type StudioArchetype =
  | "bench-press"
  | "incline-press"
  | "squat"
  | "deadlift"
  | "overhead-press"
  | "pull-up"
  | "row"
  | "bicep-curl"
  | "tricep-extension"
  | "lateral-raise"
  | "lunge"
  | "hip-thrust"
  | "plank"
  | "cardio"
  | "general";

/**
 * Normalizes any muscle name string to our standard MuscleGroup taxonomy
 */
export function normalizeMuscle(m?: string | null): MuscleGroup {
  const s = (m ?? "").toLowerCase();
  if (s.includes("chest") || s.includes("pec")) return "chest";
  if (s.includes("lat") || s.includes("mid back") || s.includes("back")) return "lats";
  if (s.includes("trap")) return "traps";
  if (s.includes("shoulder") || s.includes("delt")) return "shoulders";
  if (s.includes("bicep")) return "biceps";
  if (s.includes("tricep")) return "triceps";
  if (s.includes("forearm")) return "forearms";
  if (s.includes("oblique")) return "obliques";
  if (s.includes("ab") || s.includes("core")) return "abs";
  if (s.includes("quad")) return "quads";
  if (s.includes("hamstring")) return "hamstrings";
  if (s.includes("glute")) return "glutes";
  if (s.includes("calv")) return "calves";
  if (s.includes("cardio") || s.includes("heart")) return "cardio";
  return "full-body";
}

/**
 * Infers muscle groups from exercise name and primary/secondary muscles
 */
export function resolveExerciseMuscles(
  name: string,
  primaryMuscle?: string | null,
  secondaryMuscles?: string[] | null
): { primary: MuscleGroup; secondary: MuscleGroup[] } {
  const n = name.toLowerCase();
  let prim = normalizeMuscle(primaryMuscle);

  // Name inference fallbacks if primary muscle is generic
  if (prim === "full-body") {
    if (n.includes("bench") || n.includes("push-up") || n.includes("fly") || n.includes("pec")) prim = "chest";
    else if (n.includes("squat") || n.includes("leg press") || n.includes("leg extension") || n.includes("lunge")) prim = "quads";
    else if (n.includes("deadlift") || n.includes("rdl") || n.includes("leg curl")) prim = "hamstrings";
    else if (n.includes("pull-up") || n.includes("pulldown") || n.includes("row")) prim = "lats";
    else if ((n.includes("overhead") && !n.includes("tricep")) || n.includes("shoulder press") || n.includes("lateral raise")) prim = "shoulders";
    else if (n.includes("curl")) prim = "biceps";
    else if (n.includes("tricep") || n.includes("dip") || n.includes("skull") || n.includes("kickback") || n.includes("french press")) prim = "triceps";
    else if (n.includes("plank") || n.includes("crunch") || n.includes("twist") || n.includes("abs") || n.includes("rollout") || n.includes("dragon") || n.includes("woodchopper") || n.includes("pallof") || n.includes("toes to bar")) prim = "abs";
    else if (n.includes("calf")) prim = "calves";
    else if (n.includes("hip thrust") || n.includes("glute")) prim = "glutes";
    else if ((/\b(run|running)\b/).test(n) || n.includes("jump rope") || n.includes("burpee") || n.includes("cardio")) prim = "cardio";
  }

  const sec = (secondaryMuscles ?? []).map(normalizeMuscle).filter((m) => m !== prim);

  // Common synergist additions
  if (prim === "chest" && !sec.includes("triceps")) sec.push("triceps");
  if (prim === "chest" && !sec.includes("shoulders")) sec.push("shoulders");
  if (prim === "quads" && !sec.includes("glutes")) sec.push("glutes");
  if (prim === "lats" && !sec.includes("biceps")) sec.push("biceps");
  if (prim === "hamstrings" && !sec.includes("glutes")) sec.push("glutes");

  return { primary: prim, secondary: sec };
}

/**
 * Resolves 3D CGI Mannequin Studio exercise pose archetype (Saran 2 - Gaya Gymshark & Caliber)
 */
export function resolveStudioArchetype(
  name: string,
  primaryMuscle?: string | null,
  equipment?: string | null,
  movementType?: string | null
): StudioArchetype {
  const n = name.toLowerCase();
  const m = (primaryMuscle ?? "").toLowerCase();
  const mov = (movementType ?? "").toLowerCase();

  // Cardio movements
  if (
    (/\b(run|running)\b/).test(n) ||
    n.includes("treadmill") ||
    (n.includes("jump rope") || (n.includes("rope") && !n.includes("crunch") && !n.includes("pushdown") && !n.includes("curl") && !n.includes("extension"))) ||
    n.includes("rowing") ||
    n.includes("burpee") ||
    n.includes("cardio") ||
    mov === "cardio" ||
    m === "cardio"
  ) {
    return "cardio";
  }

  // Incline press variants
  if (n.includes("incline") && (n.includes("bench") || n.includes("press") || m.includes("chest"))) {
    return "incline-press";
  }

  // Bench press / Push-ups / Flat Chest
  if (
    n.includes("bench") ||
    n.includes("push-up") ||
    n.includes("pushup") ||
    n.includes("chest press") ||
    n.includes("floor press") ||
    (m.includes("chest") && mov === "push")
  ) {
    return "bench-press";
  }

  // Squats / Leg press
  if (n.includes("squat") || n.includes("leg press") || n.includes("hack") || (m.includes("quad") && mov === "squat")) {
    return "squat";
  }

  // Deadlift & Hinges
  if (n.includes("deadlift") || n.includes("rdl") || n.includes("rack pull") || n.includes("good morning") || (m.includes("hamstring") && mov === "hinge")) {
    return "deadlift";
  }

  // Hip thrust & Glute bridge
  if (n.includes("thrust") || n.includes("glute bridge") || (m.includes("glute") && mov === "hinge")) {
    return "hip-thrust";
  }

  // Lunges & Split squats
  if (n.includes("lunge") || n.includes("split squat") || n.includes("step up")) {
    return "lunge";
  }

  // Overhead press / Shoulders
  if ((n.includes("overhead") && !n.includes("tricep") && !m.includes("tricep")) || n.includes("shoulder press") || n.includes("military") || n.includes("arnold") || n.includes("pike push")) {
    return "overhead-press";
  }
  if (n.includes("lateral raise") || n.includes("front raise") || n.includes("face pull") || n.includes("rear delt")) {
    return "lateral-raise";
  }

  // Pull-up & Lat pulldown
  if (n.includes("pull-up") || n.includes("chin-up") || n.includes("pulldown") || n.includes("pull up") || n.includes("chin up")) {
    return "pull-up";
  }

  // Rows (Barbell, Dumbbell, Cable)
  if (n.includes("row") || (m.includes("lat") && mov === "pull") || (m.includes("back") && mov === "pull")) {
    return "row";
  }

  // Arms: Biceps & Triceps
  if (n.includes("curl") || m.includes("bicep")) {
    return "bicep-curl";
  }
  if (n.includes("tricep") || n.includes("skull") || n.includes("dip") || n.includes("pushdown") || n.includes("kickback") || n.includes("french press") || m.includes("tricep")) {
    return "tricep-extension";
  }

  // Core & Plank
  if (n.includes("plank") || n.includes("hollow") || n.includes("hold") || n.includes("crunch") || n.includes("sit-up") || n.includes("rollout") || n.includes("dragon") || n.includes("woodchopper") || n.includes("pallof") || n.includes("toes to bar") || mov === "core" || m === "abs" || m === "obliques") {
    return "plank";
  }

  return "general";
}

/**
 * Exercise Visual Component
 * Provides dual modes:
 * 1. Saran 1: Anatomical Muscle Heatmap (Gaya Apple Health & WHOOP)
 * 2. Saran 2: 3D CGI Mannequin Studio (Gaya Gymshark & Caliber)
 * 100% Client-Side Vector Graphic (0ms load time, ultra-lightweight, zero external downloads).
 */
export function ExerciseVisual({
  name,
  primaryMuscle,
  secondaryMuscles,
  equipment,
  movementType,
  imageUrl,
  size = "md",
  className,
  defaultView = "heatmap",
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const [viewMode, setViewMode] = useState<"heatmap" | "studio3d">(defaultView);
  const uid = useId().replace(/:/g, "-");

  const { primary, secondary } = resolveExerciseMuscles(name, primaryMuscle, secondaryMuscles);
  const archetype = resolveStudioArchetype(name, primaryMuscle, equipment, movementType);

  const sizeClasses = {
    sm: "size-10 rounded-md",
    md: "size-14 rounded-xl",
    lg: "size-24 rounded-2xl",
    xl: "w-full h-80 sm:h-96 rounded-2xl",
  };

  const isLarge = size === "xl";
  const isSmall = size === "sm";

  // If a custom image was explicitly provided from database, render it
  if (imageUrl && !imgFailed) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-card border shrink-0 flex items-center justify-center shadow-sm select-none",
          sizeClasses[size],
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="size-full object-cover"
        />
      </div>
    );
  }

  // Unique IDs for SVG gradients and filters to avoid cross-SVG collisions
  const maroonGrad = `m-heat-${uid}`;
  const roseGrad = `r-heat-${uid}`;
  const neutralBody = `n-body-${uid}`;
  const glowFilter = `glow-${uid}`;
  const chromeGrad = `chrome-${uid}`;
  const studioSpotlight = `spot-${uid}`;
  const floorGrad = `floor-${uid}`;

  // Determine which side of the body is the main focus for compact anatomical view
  const isBackFocused = ["lats", "traps", "triceps", "hamstrings", "glutes"].includes(primary);

  return (
    <div
      className={cn(
        "relative overflow-hidden shrink-0 flex flex-col items-center justify-center border transition-all select-none shadow-sm",
        viewMode === "studio3d"
          ? "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100"
          : "bg-gradient-to-br from-card via-muted/20 to-muted/60",
        sizeClasses[size],
        className
      )}
      aria-label={`${name} visual illustration`}
    >
      {/* 3D Medical Metric Grid Background */}
      <svg className="absolute inset-0 size-full opacity-[0.06] pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern id={`metric-grid-${uid}`} width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={`url(#metric-grid-${uid})`} />
      </svg>

      {/* SVG Global Definitions */}
      <svg className="sr-only" aria-hidden="true">
        <defs>
          {/* Primary Target Muscle: Radiant D'GYM Maroon Heatmap */}
          <linearGradient id={maroonGrad} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="50%" stopColor="#be123c" />
            <stop offset="100%" stopColor="#881337" />
          </linearGradient>

          {/* Secondary Synergist Muscle: Soft Rose Heatmap */}
          <linearGradient id={roseGrad} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fda4af" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>

          {/* Neutral Inactive Muscle Body Contours */}
          <linearGradient id={neutralBody} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          {/* Metallic 3D Studio Chrome */}
          <linearGradient id={chromeGrad} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="35%" stopColor="#475569" />
            <stop offset="70%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* Studio Radial Spotlight */}
          <radialGradient id={studioSpotlight} cx="50%" cy="25%" r="65%">
            <stop offset="0%" stopColor="#475569" stopOpacity="0.4" />
            <stop offset="60%" stopColor="#1e293b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
          </radialGradient>

          {/* Studio Floor Reflection */}
          <radialGradient id={floorGrad} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#334155" stopOpacity="0.6" />
            <stop offset="80%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>

          {/* Neon Maroon Glow Filter */}
          <filter id={glowFilter} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#f43f5e" floodOpacity="0.85" />
          </filter>
        </defs>
      </svg>

      {/* INTERACTIVE VIEW SWITCHER HEADER (DETAIL VIEW) */}
      {isLarge && (
        <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-auto">
          {/* View Switcher Tabs: Saran 1 (Anatomi) vs Saran 2 (Pose 3D) */}
          <div className="flex items-center gap-1 rounded-xl bg-background/85 p-1 backdrop-blur-md border shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("heatmap")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer",
                viewMode === "heatmap"
                  ? "bg-primary text-primary-foreground shadow-sm scale-100"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Activity className="size-3.5" />
              <span>Anatomi (Heatmap)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("studio3d")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer",
                viewMode === "studio3d"
                  ? "bg-primary text-primary-foreground shadow-sm scale-100"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Sparkles className="size-3.5 text-amber-400" />
              <span>Pose 3D Studio</span>
            </button>
          </div>

          {/* Equipment & Mechanics Badge */}
          <div className="hidden sm:flex items-center gap-2">
            {equipment && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-background/70 backdrop-blur border text-muted-foreground">
                <Dumbbell className="size-3" />
                {equipment}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary/10 border border-primary/20 text-primary">
              {viewMode === "studio3d" ? "Gymshark 3D Poser" : "Apple Health Heatmap"}
            </span>
          </div>
        </div>
      )}

      {/* RENDER VIEW BASED ON VIEWMODE AND SIZE */}
      {viewMode === "studio3d" ? (
        // SARAN 2: 3D CGI MANNEQUIN STUDIO (GYMSHARK & CALIBER STYLE)
        <div className={cn("size-full flex items-center justify-center", isLarge ? "pt-10 pb-12" : "p-1.5")}>
          <StudioMannequinView
            archetype={archetype}
            primary={primary}
            maroonId={maroonGrad}
            chromeId={chromeGrad}
            floorId={floorGrad}
            glowId={glowFilter}
          />
        </div>
      ) : (
        // SARAN 1: ANATOMICAL MUSCLE HEATMAP (APPLE HEALTH & WHOOP STYLE)
        <>
          {isLarge ? (
            // DETAIL VIEW (XL): DUAL ANTERIOR + POSTERIOR VIEWS SIDE-BY-SIDE
            <div className="relative flex w-full max-w-lg items-center justify-center gap-6 p-4 pt-10 pb-12 sm:gap-12">
              {/* Anterior (Front) Anatomical View */}
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                  Anterior (Front)
                </span>
                <div className="h-44 w-24 sm:h-52 sm:w-30">
                  <AnatomicalBodyFront
                    primary={primary}
                    secondary={secondary}
                    maroonId={maroonGrad}
                    roseId={roseGrad}
                    bodyId={neutralBody}
                    glowId={glowFilter}
                  />
                </div>
              </div>

              {/* Center Dividing Metric Line */}
              <div className="h-44 w-px bg-border/60" />

              {/* Posterior (Back) Anatomical View */}
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                  Posterior (Back)
                </span>
                <div className="h-44 w-24 sm:h-52 sm:w-30">
                  <AnatomicalBodyBack
                    primary={primary}
                    secondary={secondary}
                    maroonId={maroonGrad}
                    roseId={roseGrad}
                    bodyId={neutralBody}
                    glowId={glowFilter}
                  />
                </div>
              </div>
            </div>
          ) : isSmall ? (
            // COMPACT GLYPH (SM): MINI SINGLE VIEW
            <div className="size-full p-1">
              {isBackFocused ? (
                <AnatomicalBodyBack
                  primary={primary}
                  secondary={secondary}
                  maroonId={maroonGrad}
                  roseId={roseGrad}
                  bodyId={neutralBody}
                  glowId={glowFilter}
                />
              ) : (
                <AnatomicalBodyFront
                  primary={primary}
                  secondary={secondary}
                  maroonId={maroonGrad}
                  roseId={roseGrad}
                  bodyId={neutralBody}
                  glowId={glowFilter}
                />
              )}
            </div>
          ) : (
            // STANDARD / MEDIUM (MD/LG): FOCUSED HERO HEATMAP
            <div className="size-full p-1.5 flex items-center justify-center">
              <div className="size-full max-h-full aspect-[1/2]">
                {isBackFocused ? (
                  <AnatomicalBodyBack
                    primary={primary}
                    secondary={secondary}
                    maroonId={maroonGrad}
                    roseId={roseGrad}
                    bodyId={neutralBody}
                    glowId={glowFilter}
                  />
                ) : (
                  <AnatomicalBodyFront
                    primary={primary}
                    secondary={secondary}
                    maroonId={maroonGrad}
                    roseId={roseGrad}
                    bodyId={neutralBody}
                    glowId={glowFilter}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* BOTTOM METRIC LEGEND CHIPS (ONLY IN XL DETAIL VIEW) */}
      {isLarge && (
        <div className="absolute bottom-3 inset-x-3 flex items-center justify-between text-xs text-muted-foreground px-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-600 animate-pulse shadow-sm shadow-rose-600/50" />
              <strong className="text-foreground capitalize">{primary}</strong> (Prime Mover)
            </span>
            {secondary.length > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-full bg-rose-300" />
                <span>{secondary.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")} (Synergists)</span>
              </span>
            )}
          </div>
          {movementType && (
            <span className="hidden sm:inline-block font-mono text-[11px] uppercase tracking-wider text-muted-foreground/80">
              Pattern: {movementType}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * -------------------------------------------------------------------------------------------------
 * SARAN 1: ANATOMICAL MUSCLE HEATMAP VECTORS (APPLE HEALTH & WHOOP STYLE)
 * -------------------------------------------------------------------------------------------------
 */

/**
 * Anterior (Front) Anatomical Body Vector
 */
function AnatomicalBodyFront({
  primary,
  secondary,
  maroonId,
  roseId,
  bodyId,
  glowId,
}: {
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  maroonId: string;
  roseId: string;
  bodyId: string;
  glowId: string;
}) {
  const getStyle = (m: MuscleGroup) => {
    if (primary === m || primary === "full-body" || (primary === "cardio" && m === "quads")) {
      return { fill: `url(#${maroonId})`, filter: `url(#${glowId})`, stroke: "#fff", strokeWidth: 0.6 };
    }
    if (secondary.includes(m)) {
      return { fill: `url(#${roseId})`, stroke: "#fda4af", strokeWidth: 0.5 };
    }
    return { fill: `url(#${bodyId})`, opacity: 0.22, stroke: "#64748b", strokeWidth: 0.5 };
  };

  const defaultBody = { fill: `url(#${bodyId})`, opacity: 0.22, stroke: "#64748b", strokeWidth: 0.5 };

  return (
    <svg viewBox="0 0 80 160" className="size-full drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head & Neck */}
      <circle cx="40" cy="16" r="8.5" {...defaultBody} />
      <path d="M 36 24 L 36 30 L 44 30 L 44 24 Z" {...defaultBody} />

      {/* Trapezius & Clavicles */}
      <path d="M 33 28 Q 40 29 47 28 L 50 33 L 30 33 Z" {...getStyle("traps")} />

      {/* Shoulders / Anterior Deltoids */}
      <path d="M 28 32 Q 18 36 18 46 Q 25 46 28 37 Z" {...getStyle("shoulders")} />
      <path d="M 52 32 Q 62 36 62 46 Q 55 46 52 37 Z" {...getStyle("shoulders")} />

      {/* Pectoralis Major (Chest) */}
      <path d="M 30 35 Q 39 34 39 49 Q 30 49 28 41 Z" {...getStyle("chest")} />
      <path d="M 50 35 Q 41 34 41 49 Q 50 49 52 41 Z" {...getStyle("chest")} />

      {/* Biceps (Front Arms) */}
      <path d="M 19 46 Q 16 56 20 65 Q 24 61 24 49 Z" {...getStyle("biceps")} />
      <path d="M 61 46 Q 64 56 60 65 Q 56 61 56 49 Z" {...getStyle("biceps")} />

      {/* Forearms */}
      <path d="M 19 65 L 14 86 L 19 86 L 23 65 Z" {...getStyle("forearms")} />
      <path d="M 61 65 L 66 86 L 61 86 L 57 65 Z" {...getStyle("forearms")} />

      {/* Abdominals (Six Pack) */}
      <g {...getStyle("abs")}>
        <rect x="35" y="49" width="4" height="5" rx="1" />
        <rect x="41" y="49" width="4" height="5" rx="1" />
        <rect x="35" y="55" width="4" height="5" rx="1" />
        <rect x="41" y="55" width="4" height="5" rx="1" />
        <rect x="35" y="61" width="4" height="6" rx="1" />
        <rect x="41" y="61" width="4" height="6" rx="1" />
      </g>

      {/* Obliques (Lateral Core) */}
      <path d="M 28 49 Q 33 56 33 67 L 29 67 Q 27 58 28 49 Z" {...getStyle("obliques")} />
      <path d="M 52 49 Q 47 56 47 67 L 51 67 Q 53 58 52 49 Z" {...getStyle("obliques")} />

      {/* Pelvis / Hips */}
      <path d="M 30 69 L 50 69 L 46 78 L 34 78 Z" {...defaultBody} />

      {/* Quadriceps (Front Thighs) */}
      <path d="M 31 78 Q 26 94 30 114 L 37 114 Q 40 94 37 78 Z" {...getStyle("quads")} />
      <path d="M 49 78 Q 54 94 50 114 L 43 114 Q 40 94 43 78 Z" {...getStyle("quads")} />

      {/* Knees */}
      <circle cx="33.5" cy="117" r="3.2" {...defaultBody} />
      <circle cx="46.5" cy="117" r="3.2" {...defaultBody} />

      {/* Calves & Shins */}
      <path d="M 31 121 Q 28 132 31 146 L 36 146 Q 37 132 36 121 Z" {...getStyle("calves")} />
      <path d="M 49 121 Q 52 132 49 146 L 44 146 Q 43 132 44 121 Z" {...getStyle("calves")} />

      {/* Feet */}
      <path d="M 29 146 L 36 146 L 35 152 L 27 152 Z" {...defaultBody} />
      <path d="M 51 146 L 44 146 L 45 152 L 53 152 Z" {...defaultBody} />

      {/* Cardio Pulse Heart Symbol */}
      {primary === "cardio" && (
        <circle cx="40" cy="40" r="5" fill="#f43f5e" filter={`url(#${glowId})`} className="animate-pulse" />
      )}
    </svg>
  );
}

/**
 * Posterior (Back) Anatomical Body Vector
 */
function AnatomicalBodyBack({
  primary,
  secondary,
  maroonId,
  roseId,
  bodyId,
  glowId,
}: {
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  maroonId: string;
  roseId: string;
  bodyId: string;
  glowId: string;
}) {
  const getStyle = (m: MuscleGroup) => {
    if (primary === m || primary === "full-body" || (primary === "cardio" && m === "lats")) {
      return { fill: `url(#${maroonId})`, filter: `url(#${glowId})`, stroke: "#fff", strokeWidth: 0.6 };
    }
    if (secondary.includes(m)) {
      return { fill: `url(#${roseId})`, stroke: "#fda4af", strokeWidth: 0.5 };
    }
    return { fill: `url(#${bodyId})`, opacity: 0.22, stroke: "#64748b", strokeWidth: 0.5 };
  };

  const defaultBody = { fill: `url(#${bodyId})`, opacity: 0.22, stroke: "#64748b", strokeWidth: 0.5 };

  return (
    <svg viewBox="0 0 80 160" className="size-full drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head & Occipital */}
      <circle cx="40" cy="16" r="8.5" {...defaultBody} />
      <path d="M 36 24 L 36 30 L 44 30 L 44 24 Z" {...defaultBody} />

      {/* Trapezius (Diamond Upper Back) */}
      <path d="M 40 28 L 52 37 L 40 52 L 28 37 Z" {...getStyle("traps")} />

      {/* Rear Deltoids (Posterior Shoulders) */}
      <path d="M 26 33 Q 18 37 18 47 Q 25 47 28 38 Z" {...getStyle("shoulders")} />
      <path d="M 54 33 Q 62 37 62 47 Q 55 47 52 38 Z" {...getStyle("shoulders")} />

      {/* Triceps (Horseshoe Arms) */}
      <path d="M 19 47 Q 17 57 20 65 Q 25 61 25 49 Z" {...getStyle("triceps")} />
      <path d="M 61 47 Q 63 57 60 65 Q 55 61 55 49 Z" {...getStyle("triceps")} />

      {/* Forearms */}
      <path d="M 19 65 L 15 86 L 20 86 L 23 65 Z" {...getStyle("forearms")} />
      <path d="M 61 65 L 65 86 L 60 86 L 57 65 Z" {...getStyle("forearms")} />

      {/* Latissimus Dorsi (Lats / V-Taper Wings) */}
      <path d="M 28 41 Q 38 45 38 64 L 32 66 Q 27 54 28 41 Z" {...getStyle("lats")} />
      <path d="M 52 41 Q 42 45 42 64 L 48 66 Q 53 54 52 41 Z" {...getStyle("lats")} />

      {/* Lower Back (Erector Spinae) */}
      <path d="M 37 59 L 43 59 L 43 73 L 37 73 Z" {...getStyle("lats")} />

      {/* Gluteus Maximus (Glutes / Hips) */}
      <path d="M 31 73 Q 38 71 40 75 Q 40 88 32 88 Q 28 82 31 73 Z" {...getStyle("glutes")} />
      <path d="M 49 73 Q 42 71 40 75 Q 40 88 48 88 Q 52 82 49 73 Z" {...getStyle("glutes")} />

      {/* Hamstrings (Back of Thighs) */}
      <path d="M 31 89 Q 27 102 30 114 L 37 114 Q 40 102 38 89 Z" {...getStyle("hamstrings")} />
      <path d="M 49 89 Q 53 102 50 114 L 43 114 Q 40 102 42 89 Z" {...getStyle("hamstrings")} />

      {/* Back of Knees (Popliteal) */}
      <rect x="30" y="115" width="7" height="3" rx="1.5" {...defaultBody} />
      <rect x="43" y="115" width="7" height="3" rx="1.5" {...defaultBody} />

      {/* Calves (Gastrocnemius & Soleus) */}
      <path d="M 31 119 Q 26 130 30 146 L 36 146 Q 38 130 36 119 Z" {...getStyle("calves")} />
      <path d="M 49 119 Q 54 130 50 146 L 44 146 Q 42 130 44 119 Z" {...getStyle("calves")} />

      {/* Heels */}
      <path d="M 28 146 L 35 146 L 34 152 L 27 152 Z" {...defaultBody} />
      <path d="M 52 146 L 45 146 L 46 152 L 53 152 Z" {...defaultBody} />
    </svg>
  );
}

/**
 * -------------------------------------------------------------------------------------------------
 * SARAN 2: 3D CGI MANNEQUIN STUDIO (GYMSHARK & CALIBER STYLE)
 * -------------------------------------------------------------------------------------------------
 * Athletic 3D Mannequin in high-tech studio environment with volumetric shading,
 * realistic equipment perspective, contact floor occlusion shadow, and neon active muscle rim light.
 */
function StudioMannequinView({
  archetype,
  primary,
  maroonId,
  chromeId,
  floorId,
  glowId,
}: {
  archetype: StudioArchetype;
  primary: MuscleGroup;
  maroonId: string;
  chromeId: string;
  floorId: string;
  glowId: string;
}) {
  const activeStyle = { fill: `url(#${maroonId})`, filter: `url(#${glowId})`, stroke: "#ffe4e6", strokeWidth: 0.8 };
  const chromeStyle = { fill: `url(#${chromeId})`, stroke: "#64748b", strokeWidth: 0.7 };
  const steelBar = { fill: "#cbd5e1", stroke: "#94a3b8", strokeWidth: 1 };
  const weightPlate = { fill: "#0f172a", stroke: "#334155", strokeWidth: 1.2 };
  const benchStyle = { fill: "#1e293b", stroke: "#475569", strokeWidth: 1.2 };

  return (
    <svg viewBox="0 0 220 180" className="size-full drop-shadow-md select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Studio Lighting: Ambient Floor Contact Ellipse */}
      <ellipse cx="110" cy="162" rx="85" ry="14" fill={`url(#${floorId})`} />
      <ellipse cx="110" cy="161" rx="55" ry="7" fill="#000000" opacity="0.55" />

      {/* Render Archetype Pose */}
      {archetype === "bench-press" && (
        <g>
          {/* Flat Gym Bench */}
          <line x1="60" y1="135" x2="60" y2="160" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <line x1="160" y1="135" x2="160" y2="160" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <line x1="50" y1="160" x2="70" y2="160" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
          <line x1="150" y1="160" x2="170" y2="160" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
          <rect x="52" y="128" width="116" height="10" rx="4" {...benchStyle} />

          {/* Mannequin Body (Supine Bench Press Position) */}
          <circle cx="68" cy="122" r="8" {...chromeStyle} />
          {/* Arched Athletic Chest - Glowing Active Muscle */}
          <path d="M 76 126 Q 95 116 115 125 L 115 130 Q 95 124 76 128 Z" {...activeStyle} />
          {/* Torso & Abdomen */}
          <path d="M 95 127 Q 115 127 132 128 L 132 133 L 95 133 Z" {...chromeStyle} />
          {/* Legs Bent to Floor */}
          <path d="M 132 130 Q 148 132 155 142 L 157 160 L 165 160 L 161 140 Q 152 128 132 128 Z" {...chromeStyle} />

          {/* Arms Pressing Barbell Upward */}
          <path d="M 90 123 L 88 108 L 102 96" stroke="#475569" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Triceps Highlight */}
          <path d="M 90 123 L 88 108" stroke="url(#maroonId)" strokeWidth="3" strokeLinecap="round" filter={`url(#${glowId})`} />
          <path d="M 112 123 L 118 108 L 110 96" stroke="#475569" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Olympic Barbell */}
          <line x1="35" y1="96" x2="185" y2="96" {...steelBar} strokeWidth="3.5" />
          {/* Knurling Grips */}
          <line x1="88" y1="96" x2="122" y2="96" stroke="#64748b" strokeWidth="4" strokeDasharray="2,2" />
          {/* 20kg Heavy Bumper Plates */}
          <rect x="42" y="76" width="10" height="40" rx="3" {...weightPlate} />
          <circle cx="47" cy="96" r="3" fill="#e11d48" />
          <rect x="168" y="76" width="10" height="40" rx="3" {...weightPlate} />
          <circle cx="173" cy="96" r="3" fill="#e11d48" />
        </g>
      )}

      {archetype === "incline-press" && (
        <g>
          {/* Incline Gym Bench at 45 Degrees */}
          <line x1="65" y1="145" x2="65" y2="160" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <line x1="145" y1="145" x2="145" y2="160" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <path d="M 70 148 L 105 110 L 112 116 L 77 154 Z" {...benchStyle} />
          <rect x="105" y="146" width="45" height="8" rx="2" {...benchStyle} />

          {/* Mannequin Seated Incline */}
          <circle cx="98" cy="98" r="8" {...chromeStyle} />
          {/* Upper Chest (Clavicular Head) - Glowing Active Muscle */}
          <path d="M 104 105 Q 118 108 126 118 L 120 122 Q 112 112 102 110 Z" {...activeStyle} />
          {/* Torso & Hips */}
          <path d="M 102 110 L 120 122 L 122 146 L 105 146 Z" {...chromeStyle} />
          {/* Legs */}
          <path d="M 122 144 Q 138 144 144 150 L 146 160" stroke="#475569" strokeWidth="6" strokeLinecap="round" />

          {/* Dual Dumbbells Pressed Overhead */}
          <line x1="92" y1="84" x2="100" y2="104" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <line x1="124" y1="84" x2="118" y2="104" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          {/* Dumbbells */}
          <rect x="84" y="80" width="16" height="7" rx="2" {...weightPlate} />
          <rect x="116" y="80" width="16" height="7" rx="2" {...weightPlate} />
        </g>
      )}

      {archetype === "squat" && (
        <g>
          {/* Deep Athletic Squat Pose */}
          {/* Head & Neck */}
          <circle cx="110" cy="74" r="8.5" {...chromeStyle} />
          <line x1="110" y1="82" x2="110" y2="88" stroke="#475569" strokeWidth="4" />

          {/* Torso Athletic Incline */}
          <path d="M 100 88 L 120 88 L 116 118 L 104 118 Z" {...chromeStyle} />

          {/* Quadriceps (Thighs Parallel to Floor) - Glowing Active Muscle */}
          <path d="M 104 118 Q 80 120 80 132 L 88 134 Q 96 126 114 122 Z" {...activeStyle} />
          <path d="M 116 118 Q 140 120 140 132 L 132 134 Q 124 126 106 122 Z" {...activeStyle} />

          {/* Calves & Feet Planted on Floor */}
          <path d="M 80 132 L 86 160 M 140 132 L 134 160" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
          <line x1="78" y1="160" x2="94" y2="160" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <line x1="126" y1="160" x2="142" y2="160" stroke="#334155" strokeWidth="3" strokeLinecap="round" />

          {/* Olympic Barbell on Upper Traps */}
          <line x1="45" y1="84" x2="175" y2="84" {...steelBar} strokeWidth="4" />
          {/* Hands Gripping Bar */}
          <circle cx="85" cy="84" r="3.5" fill="#64748b" />
          <circle cx="135" cy="84" r="3.5" fill="#64748b" />
          {/* Heavy 20kg Bumper Plates */}
          <rect x="52" y="64" width="10" height="40" rx="3" {...weightPlate} />
          <circle cx="57" cy="84" r="3.5" fill="#e11d48" />
          <rect x="158" y="64" width="10" height="40" rx="3" {...weightPlate} />
          <circle cx="163" cy="84" r="3.5" fill="#e11d48" />
        </g>
      )}

      {archetype === "deadlift" && (
        <g>
          {/* Hip Hinge / Mid-Shin Deadlift Pull Posture */}
          {/* Head & Spine */}
          <circle cx="138" cy="94" r="8" {...chromeStyle} />
          {/* Flat Athletic Back / Erector Spinae - Glowing Active Muscle */}
          <path d="M 85 110 Q 110 102 132 98 L 130 105 Q 110 108 85 116 Z" {...activeStyle} />
          {/* Glutes & Hamstrings - Glowing Active Muscle */}
          <path d="M 85 110 Q 75 118 84 135 L 92 132 Q 85 120 90 114 Z" {...activeStyle} />
          {/* Shins to Floor */}
          <line x1="84" y1="135" x2="90" y2="160" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />

          {/* Arms Hanging Straight Down to Barbell */}
          <line x1="128" y1="102" x2="128" y2="140" stroke="#475569" strokeWidth="5" strokeLinecap="round" />

          {/* Loaded Olympic Barbell at Mid-Shin */}
          <line x1="60" y1="140" x2="185" y2="140" {...steelBar} strokeWidth="3.5" />
          <rect x="115" y="118" width="11" height="44" rx="3" {...weightPlate} />
          <circle cx="120.5" cy="140" r="3.5" fill="#e11d48" />
          <rect x="170" y="118" width="11" height="44" rx="3" {...weightPlate} />
          <circle cx="175.5" cy="140" r="3.5" fill="#e11d48" />
        </g>
      )}

      {archetype === "overhead-press" && (
        <g>
          {/* Standing Tall Overhead Press Lockout */}
          <circle cx="110" cy="82" r="8.5" {...chromeStyle} />
          {/* Torso & Core */}
          <rect x="103" y="90" width="14" height="34" rx="4" {...chromeStyle} />
          {/* Deltoids (Shoulders) - Glowing Active Muscle */}
          <circle cx="98" cy="92" r="5" {...activeStyle} />
          <circle cx="122" cy="92" r="5" {...activeStyle} />

          {/* Legs Grounded Hip Width */}
          <line x1="105" y1="124" x2="100" y2="160" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="115" y1="124" x2="120" y2="160" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />

          {/* Arms Locked Out Overhead */}
          <path d="M 98 92 L 95 68 L 102 50" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M 122 92 L 125 68 L 118 50" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />

          {/* Barbell Pressed at Full Lockout */}
          <line x1="45" y1="50" x2="175" y2="50" {...steelBar} strokeWidth="3.5" />
          <rect x="52" y="32" width="9" height="36" rx="2" {...weightPlate} />
          <rect x="159" y="32" width="9" height="36" rx="2" {...weightPlate} />
        </g>
      )}

      {archetype === "pull-up" && (
        <g>
          {/* Overhead Heavy Duty Pull-Up Rig */}
          <line x1="45" y1="36" x2="175" y2="36" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
          <line x1="55" y1="20" x2="55" y2="36" stroke="#334155" strokeWidth="4" />
          <line x1="165" y1="20" x2="165" y2="36" stroke="#334155" strokeWidth="4" />

          {/* Hands Gripping Bar */}
          <circle cx="82" cy="36" r="4" fill="#64748b" />
          <circle cx="138" cy="36" r="4" fill="#64748b" />

          {/* Arms in Pulling Position */}
          <path d="M 82 36 L 90 56 L 98 68" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
          <path d="M 138 36 L 130 56 L 122 68" stroke="#475569" strokeWidth="5" strokeLinecap="round" />

          {/* Head Elevated to Bar Level */}
          <circle cx="110" cy="54" r="8" {...chromeStyle} />

          {/* Latissimus Dorsi (V-Taper Wings) - Glowing Active Muscle */}
          <path d="M 98 64 Q 110 70 122 64 L 116 88 Q 110 82 104 88 Z" {...activeStyle} />
          {/* Legs Suspended in Air */}
          <path d="M 106 88 L 105 130 L 115 145" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
          <path d="M 114 88 L 115 130 L 110 145" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
        </g>
      )}

      {archetype === "row" && (
        <g>
          {/* Bent Over Athletic Row Pose */}
          <circle cx="140" cy="95" r="8" {...chromeStyle} />
          {/* Back & Lats - Glowing Active Muscle */}
          <path d="M 90 115 Q 115 106 135 102 L 132 110 Q 115 113 90 122 Z" {...activeStyle} />
          {/* Lower Body Stable Base */}
          <path d="M 90 118 L 84 140 L 90 160" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />

          {/* Arms Pulling Barbell to Waist */}
          <path d="M 130 106 L 120 124 L 112 120" stroke="#475569" strokeWidth="5" strokeLinecap="round" />

          {/* Barbell Pulled into Torso */}
          <line x1="65" y1="120" x2="165" y2="120" {...steelBar} strokeWidth="3.5" />
          <rect x="72" y="104" width="8" height="32" rx="2" {...weightPlate} />
          <rect x="150" y="104" width="8" height="32" rx="2" {...weightPlate} />
        </g>
      )}

      {archetype === "bicep-curl" && (
        <g>
          {/* Standing Bicep Curl Peak Contraction */}
          <circle cx="110" cy="74" r="8.5" {...chromeStyle} />
          {/* Torso */}
          <rect x="103" y="82" width="14" height="42" rx="4" {...chromeStyle} />
          {/* Legs */}
          <line x1="105" y1="124" x2="102" y2="160" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="115" y1="124" x2="118" y2="160" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />

          {/* Biceps Brachii - Glowing Active Muscle with Peak Curvature */}
          <path d="M 96 86 Q 88 95 94 105 L 98 102 Q 94 94 98 86 Z" {...activeStyle} />
          <path d="M 124 86 Q 132 95 126 105 L 122 102 Q 126 94 122 86 Z" {...activeStyle} />

          {/* Forearms Curled Holding Hex Dumbbells */}
          <path d="M 94 105 L 86 92" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M 126 105 L 134 92" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
          {/* Hex Dumbbells */}
          <rect x="78" y="86" width="16" height="8" rx="2" {...weightPlate} />
          <rect x="126" y="86" width="16" height="8" rx="2" {...weightPlate} />
        </g>
      )}

      {archetype === "tricep-extension" && (
        <g>
          {/* Standing Tricep Pushdown Lockout */}
          <circle cx="110" cy="74" r="8.5" {...chromeStyle} />
          <rect x="103" y="82" width="14" height="42" rx="4" {...chromeStyle} />
          <line x1="105" y1="124" x2="102" y2="160" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="115" y1="124" x2="118" y2="160" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />

          {/* Triceps (Horseshoe Arms) - Glowing Active Muscle */}
          <path d="M 96 86 L 92 104 L 95 106 L 98 88 Z" {...activeStyle} />
          <path d="M 124 86 L 128 104 L 125 106 L 122 88 Z" {...activeStyle} />

          {/* Forearms Pushing Straight Down */}
          <path d="M 92 104 L 95 125 M 128 104 L 125 125" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
          {/* Cable Attachment Bar */}
          <line x1="90" y1="125" x2="130" y2="125" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
          <line x1="110" y1="45" x2="110" y2="125" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3,3" />
        </g>
      )}

      {archetype === "lateral-raise" && (
        <g>
          {/* Standing Lateral Raise T-Pose */}
          <circle cx="110" cy="74" r="8.5" {...chromeStyle} />
          <rect x="104" y="82" width="12" height="42" rx="4" {...chromeStyle} />
          <line x1="106" y1="124" x2="102" y2="160" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="114" y1="124" x2="118" y2="160" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />

          {/* Lateral Deltoids (Shoulders) - Glowing Active Muscle */}
          <circle cx="98" cy="85" r="5.5" {...activeStyle} />
          <circle cx="122" cy="85" r="5.5" {...activeStyle} />

          {/* Arms Elevated Horizontally Forming T */}
          <line x1="96" y1="85" x2="65" y2="86" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
          <line x1="124" y1="85" x2="155" y2="86" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
          {/* Dumbbells at Ends */}
          <rect x="56" y="80" width="12" height="12" rx="2" {...weightPlate} />
          <rect x="152" y="80" width="12" height="12" rx="2" {...weightPlate} />
        </g>
      )}

      {archetype === "lunge" && (
        <g>
          {/* Split Squat / Lunge Deep 90-Degree Posture */}
          <circle cx="110" cy="75" r="8.5" {...chromeStyle} />
          <rect x="105" y="84" width="12" height="34" rx="4" {...chromeStyle} />

          {/* Front Quad (90 Degree Bend) - Glowing Active Muscle */}
          <path d="M 112 118 L 138 120 L 140 148 L 132 148 L 130 126 L 112 124 Z" {...activeStyle} />
          <line x1="130" y1="148" x2="148" y2="148" stroke="#334155" strokeWidth="3" strokeLinecap="round" />

          {/* Back Leg Extended with Knee Hovering Above Floor */}
          <path d="M 106 118 L 86 132 L 86 156" stroke="#475569" strokeWidth="5" strokeLinecap="round" />

          {/* Dumbbells Held at Sides */}
          <rect x="96" y="104" width="8" height="16" rx="2" {...weightPlate} />
          <rect x="116" y="104" width="8" height="16" rx="2" {...weightPlate} />
        </g>
      )}

      {archetype === "hip-thrust" && (
        <g>
          {/* Bench Supporting Upper Back */}
          <rect x="45" y="125" width="25" height="35" rx="3" {...benchStyle} />

          {/* Head & Upper Back on Bench */}
          <circle cx="68" cy="120" r="7.5" {...chromeStyle} />

          {/* Hips Driven to Full Terminal Extension / Glutes - Glowing Active Muscle */}
          <path d="M 72 125 Q 95 110 120 110 L 122 120 Q 95 120 72 130 Z" {...activeStyle} />

          {/* Legs Bent at 90 Degrees Planted on Floor */}
          <path d="M 120 110 L 135 125 L 135 160" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />

          {/* Barbell Across Hip Crease */}
          <line x1="75" y1="108" x2="145" y2="108" {...steelBar} strokeWidth="4" />
          <rect x="80" y="96" width="8" height="24" rx="2" {...weightPlate} />
          <rect x="132" y="96" width="8" height="24" rx="2" {...weightPlate} />
        </g>
      )}

      {archetype === "plank" && (
        <g>
          {/* Horizontal Rigid Prone Plank Pose */}
          <circle cx="60" cy="125" r="7.5" {...chromeStyle} />
          {/* Forearms Grounded */}
          <line x1="65" y1="130" x2="72" y2="152" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
          <line x1="72" y1="152" x2="88" y2="152" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />

          {/* Abdominals & Core - Glowing Active Muscle */}
          <path d="M 70 128 L 125 132 L 125 138 L 70 134 Z" {...activeStyle} />

          {/* Torso to Toes Line */}
          <path d="M 125 132 L 165 138 L 168 152" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
        </g>
      )}

      {archetype === "cardio" && (
        <g>
          {/* Athletic Sprinter Runner Mid-Stride */}
          <circle cx="120" cy="68" r="8.5" {...chromeStyle} />
          <path d="M 112 76 L 126 76 L 118 114 L 108 114 Z" {...chromeStyle} />

          {/* Cardio Energy Pulse Glow in Center */}
          <circle cx="117" cy="88" r="6" {...activeStyle} className="animate-pulse" />

          {/* High Knee Drive (Front Leg) */}
          <path d="M 118 114 L 138 122 L 132 148" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />
          {/* Powerful Trailing Push-Off (Back Leg) */}
          <path d="M 108 114 L 88 132 L 80 156" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />

          {/* Pumping Athletic Arms */}
          <path d="M 114 78 L 135 92 L 140 82" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M 120 78 L 98 94 L 92 108" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
        </g>
      )}

      {archetype === "general" && (
        <g>
          {/* Athletic Ready Stance with Target Muscle Glowing */}
          <circle cx="110" cy="72" r="8.5" {...chromeStyle} />
          <rect x="103" y="80" width="14" height="42" rx="4" {...chromeStyle} />
          {/* Highlight target muscle */}
          {primary === "chest" && <rect x="104" y="83" width="12" height="14" rx="2" {...activeStyle} />}
          {primary === "shoulders" && (
            <>
              <circle cx="98" cy="85" r="5" {...activeStyle} />
              <circle cx="122" cy="85" r="5" {...activeStyle} />
            </>
          )}
          {primary === "biceps" && (
            <>
              <rect x="94" y="94" width="6" height="12" rx="2" {...activeStyle} />
              <rect x="120" y="94" width="6" height="12" rx="2" {...activeStyle} />
            </>
          )}
          {primary === "quads" && (
            <>
              <rect x="99" y="125" width="8" height="20" rx="3" {...activeStyle} />
              <rect x="113" y="125" width="8" height="20" rx="3" {...activeStyle} />
            </>
          )}

          {/* Arms & Legs Base */}
          <line x1="98" y1="84" x2="92" y2="120" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
          <line x1="122" y1="84" x2="128" y2="120" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
          <line x1="105" y1="122" x2="100" y2="160" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="115" y1="122" x2="120" y2="160" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
