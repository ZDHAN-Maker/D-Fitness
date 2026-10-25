"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  primaryMuscle?: string | null;
  equipment?: string | null;
  movementType?: string | null;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

/**
 * 2D/3D Exercise Visual Component
 * Renders verified 2D/3D demonstration image when available,
 * or dynamic high-definition 2D/3D isometric anatomical vector illustrations
 * highlighting the targeted muscle group, equipment, and movement trajectory.
 */
export function ExerciseVisual({
  name,
  primaryMuscle,
  equipment,
  movementType,
  imageUrl,
  size = "md",
  className,
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const muscle = (primaryMuscle ?? "").toLowerCase();
  const eq = (equipment ?? "").toLowerCase();
  const mov = (movementType ?? "").toLowerCase();
  const lowerName = name.toLowerCase();

  const sizeClasses = {
    sm: "size-10 rounded-md",
    md: "size-14 rounded-xl",
    lg: "size-24 rounded-2xl",
    xl: "w-full h-64 sm:h-72 rounded-2xl",
  };

  const isLarge = size === "xl";

  // If a valid image URL is provided and has not errored, render it
  if (imageUrl && !imgFailed) {
    return (
      <div className={cn("relative overflow-hidden bg-muted/60 border shrink-0 flex items-center justify-center", sizeClasses[size], className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`${name} illustration`}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="size-full object-cover"
        />
      </div>
    );
  }

  // Determine illustration theme based on exercise name and muscle
  const isChest = muscle.includes("chest") || lowerName.includes("bench") || lowerName.includes("push-up") || lowerName.includes("fly");
  const isBack = muscle.includes("lats") || muscle.includes("back") || lowerName.includes("row") || lowerName.includes("pull-up") || lowerName.includes("pulldown");
  const isShoulders = muscle.includes("shoulder") || muscle.includes("delt") || lowerName.includes("overhead") || lowerName.includes("lateral raise");
  const isArms = muscle.includes("biceps") || muscle.includes("triceps") || lowerName.includes("curl") || lowerName.includes("dip") || lowerName.includes("skull");
  const isLegs = muscle.includes("quad") || muscle.includes("hamstring") || muscle.includes("glute") || muscle.includes("calv") || lowerName.includes("squat") || lowerName.includes("lunge") || lowerName.includes("deadlift");
  const isCore = muscle.includes("abs") || muscle.includes("core") || muscle.includes("oblique") || lowerName.includes("plank") || lowerName.includes("crunch");

  return (
    <div
      className={cn(
        "relative overflow-hidden shrink-0 flex flex-col items-center justify-center border transition-all select-none shadow-sm",
        "bg-gradient-to-br from-card via-accent/30 to-muted/80",
        sizeClasses[size],
        className
      )}
      aria-label={`${name} 2D/3D illustration`}
    >
      {/* 3D background grid pattern */}
      <svg className="absolute inset-0 size-full opacity-[0.18]" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern id="grid-pattern" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M 12 0 L 0 0 0 12" fill="none" stroke="currentColor" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid-pattern)" />
      </svg>

      {/* Main 2D/3D Isometric Vector Illustration */}
      <div className={cn("relative flex items-center justify-center", isLarge ? "size-48" : "size-full p-1.5")}>
        <svg viewBox="0 0 120 120" className="size-full drop-shadow-md" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Primary Maroon Gradients for 3D Muscle Volumes */}
            <linearGradient id="maroon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e11d48" />
              <stop offset="50%" stopColor="#881337" />
              <stop offset="100%" stopColor="#4c0519" />
            </linearGradient>

            <linearGradient id="metal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="50%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>

            <linearGradient id="glow-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fda4af" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#881337" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* 3D Base Platform Ring */}
          <ellipse cx="60" cy="100" rx="46" ry="12" fill="url(#glow-grad)" opacity="0.6" />
          <ellipse cx="60" cy="99" rx="42" ry="10" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />

          {/* RENDER ANATOMY BASED ON CATEGORY */}
          {isChest ? (
            /* CHEST & PRESS 2D/3D POSE */
            <g transform="translate(10, 5)">
              {/* Bench / Platform */}
              <rect x="25" y="70" width="50" height="12" rx="4" fill="url(#metal-grad)" />
              <rect x="35" y="82" width="6" height="15" fill="#475569" />
              <rect x="59" y="82" width="6" height="15" fill="#475569" />
              {/* Torso / Active Pectorals */}
              <path d="M 38 60 Q 50 56 62 60 L 58 72 Q 50 74 42 72 Z" fill="url(#maroon-grad)" />
              {/* Highlight Pectoral muscles */}
              <path d="M 40 62 Q 50 58 60 62" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
              {/* Arms pushing upward */}
              <path d="M 36 62 L 28 42 L 32 38" stroke="url(#metal-grad)" strokeWidth="6" strokeLinecap="round" />
              <path d="M 64 62 L 72 42 L 68 38" stroke="url(#metal-grad)" strokeWidth="6" strokeLinecap="round" />
              {/* 3D Barbell across top */}
              <line x1="12" y1="36" x2="88" y2="36" stroke="url(#metal-grad)" strokeWidth="5" strokeLinecap="round" />
              <rect x="18" y="24" width="8" height="24" rx="2" fill="url(#maroon-grad)" />
              <rect x="74" y="24" width="8" height="24" rx="2" fill="url(#maroon-grad)" />
              {/* Head */}
              <circle cx="50" cy="50" r="7" fill="url(#metal-grad)" />
            </g>
          ) : isBack ? (
            /* BACK & LATS / PULL 2D/3D POSE */
            <g transform="translate(10, 8)">
              {/* V-Taper Lats & Spine */}
              <path d="M 35 38 L 65 38 L 56 68 L 44 68 Z" fill="url(#maroon-grad)" />
              <path d="M 50 38 L 50 68" stroke="#fff" strokeWidth="1.5" strokeDasharray="2 2" opacity="0.7" />
              {/* Shoulders & Traps */}
              <path d="M 30 42 Q 50 32 70 42" stroke="url(#maroon-grad)" strokeWidth="8" strokeLinecap="round" />
              {/* Arms pulling downward / rowing */}
              <path d="M 28 42 L 20 58 L 30 68" stroke="url(#metal-grad)" strokeWidth="6" strokeLinecap="round" />
              <path d="M 72 42 L 80 58 L 70 68" stroke="url(#metal-grad)" strokeWidth="6" strokeLinecap="round" />
              {/* Pull Bar or Cable Handle */}
              <path d="M 16 32 Q 50 24 84 32" stroke="url(#metal-grad)" strokeWidth="5" strokeLinecap="round" />
              {/* Head */}
              <circle cx="50" cy="28" r="8" fill="url(#metal-grad)" />
              {/* Lower body silhouette */}
              <path d="M 44 68 L 40 92 M 56 68 L 60 92" stroke="url(#metal-grad)" strokeWidth="7" strokeLinecap="round" />
            </g>
          ) : isShoulders ? (
            /* SHOULDERS & OVERHEAD 2D/3D POSE */
            <g transform="translate(10, 6)">
              {/* Deltoid Highlights */}
              <circle cx="30" cy="46" r="8" fill="url(#maroon-grad)" />
              <circle cx="70" cy="46" r="8" fill="url(#maroon-grad)" />
              {/* Torso */}
              <path d="M 36 46 L 64 46 L 58 78 L 42 78 Z" fill="url(#metal-grad)" />
              {/* Arms raised upward */}
              <path d="M 28 44 L 24 24" stroke="url(#metal-grad)" strokeWidth="6" strokeLinecap="round" />
              <path d="M 72 44 L 76 24" stroke="url(#metal-grad)" strokeWidth="6" strokeLinecap="round" />
              {/* Dumbbells in hands */}
              <rect x="18" y="18" width="12" height="7" rx="2" fill="url(#maroon-grad)" />
              <rect x="70" y="18" width="12" height="7" rx="2" fill="url(#maroon-grad)" />
              {/* Head */}
              <circle cx="50" cy="38" r="8" fill="url(#metal-grad)" />
              {/* Legs */}
              <path d="M 44 78 L 40 95 M 56 78 L 60 95" stroke="url(#metal-grad)" strokeWidth="6" strokeLinecap="round" />
            </g>
          ) : isArms ? (
            /* ARMS / BICEPS / TRICEPS 2D/3D POSE */
            <g transform="translate(10, 6)">
              {/* Flexed Bicep/Tricep Muscle Hero */}
              <path d="M 32 45 Q 22 55 36 68 Q 48 58 42 45 Z" fill="url(#maroon-grad)" />
              <path d="M 68 45 Q 78 55 64 68 Q 52 58 58 45 Z" fill="url(#maroon-grad)" />
              {/* Torso */}
              <path d="M 40 45 L 60 45 L 56 78 L 44 78 Z" fill="url(#metal-grad)" />
              {/* Forearms curled up */}
              <path d="M 35 66 L 38 48" stroke="url(#metal-grad)" strokeWidth="6" strokeLinecap="round" />
              <path d="M 65 66 L 62 48" stroke="url(#metal-grad)" strokeWidth="6" strokeLinecap="round" />
              {/* Dumbbells */}
              <rect x="30" y="42" width="16" height="8" rx="2" fill="url(#maroon-grad)" />
              <rect x="54" y="42" width="16" height="8" rx="2" fill="url(#maroon-grad)" />
              {/* Head */}
              <circle cx="50" cy="32" r="8" fill="url(#metal-grad)" />
            </g>
          ) : isLegs ? (
            /* LEGS / SQUAT / QUADRICEPS 2D/3D POSE */
            <g transform="translate(10, 6)">
              {/* Upper Body Torso */}
              <path d="M 40 28 L 60 28 L 56 50 L 44 50 Z" fill="url(#metal-grad)" />
              <circle cx="50" cy="20" r="7" fill="url(#metal-grad)" />
              {/* Barbell across shoulders */}
              <line x1="16" y1="24" x2="84" y2="24" stroke="url(#metal-grad)" strokeWidth="5" strokeLinecap="round" />
              <rect x="22" y="14" width="8" height="20" rx="2" fill="url(#maroon-grad)" />
              <rect x="70" y="14" width="8" height="20" rx="2" fill="url(#maroon-grad)" />
              {/* Deep Squat 3D Thighs (Quadriceps Highlight) */}
              <path d="M 44 50 L 26 64 L 38 88" stroke="url(#maroon-grad)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 56 50 L 74 64 L 62 88" stroke="url(#maroon-grad)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
              {/* Feet / Platform */}
              <ellipse cx="38" cy="90" rx="7" ry="3" fill="#334155" />
              <ellipse cx="62" cy="90" rx="7" ry="3" fill="#334155" />
            </g>
          ) : isCore ? (
            /* CORE & ABS / PLANK 2D/3D POSE */
            <g transform="translate(8, 14)">
              {/* Head */}
              <circle cx="28" cy="44" r="8" fill="url(#metal-grad)" />
              {/* Strong Horizontal Torso & Six-Pack Abs Highlight */}
              <rect x="36" y="42" width="44" height="15" rx="6" fill="url(#maroon-grad)" />
              {/* Abs Segments */}
              <line x1="50" y1="44" x2="50" y2="55" stroke="#fff" strokeWidth="1.5" opacity="0.7" />
              <line x1="62" y1="44" x2="62" y2="55" stroke="#fff" strokeWidth="1.5" opacity="0.7" />
              {/* Forearm Support */}
              <path d="M 36 48 L 30 68" stroke="url(#metal-grad)" strokeWidth="6" strokeLinecap="round" />
              {/* Legs extended back */}
              <path d="M 80 48 L 98 68" stroke="url(#metal-grad)" strokeWidth="7" strokeLinecap="round" />
            </g>
          ) : (
            /* CARDIO & FULL BODY DYNAMICS */
            <g transform="translate(10, 8)">
              {/* Head */}
              <circle cx="56" cy="22" r="8" fill="url(#metal-grad)" />
              {/* Dynamic Torso with heart energy */}
              <path d="M 48 32 L 64 32 L 58 56 L 46 56 Z" fill="url(#maroon-grad)" />
              {/* Running Arms */}
              <path d="M 50 36 L 36 46 L 44 60" stroke="url(#metal-grad)" strokeWidth="6" strokeLinecap="round" />
              <path d="M 62 36 L 76 42 L 72 58" stroke="url(#metal-grad)" strokeWidth="6" strokeLinecap="round" />
              {/* Running Stride Legs */}
              <path d="M 48 56 L 34 72 L 28 88" stroke="url(#maroon-grad)" strokeWidth="7" strokeLinecap="round" />
              <path d="M 56 56 L 72 70 L 66 90" stroke="url(#maroon-grad)" strokeWidth="7" strokeLinecap="round" />
            </g>
          )}

          {/* 3D Equipment Mini Badge in Corner for large view */}
          {isLarge && (
            <g transform="translate(75, 80)">
              <rect width="36" height="18" rx="5" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" />
              <text x="18" y="12" fill="currentColor" fontSize="8" fontWeight="bold" textAnchor="middle" className="font-display uppercase tracking-wider">
                {eq ? eq.slice(0, 7) : mov}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Detail Overlay for XL View */}
      {isLarge && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t bg-card/85 px-4 py-2 backdrop-blur">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {primaryMuscle ? `${primaryMuscle} focus` : "Full body"}
            </span>
          </div>
          <span className="rounded bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
            3D Visual
          </span>
        </div>
      )}
    </div>
  );
}

