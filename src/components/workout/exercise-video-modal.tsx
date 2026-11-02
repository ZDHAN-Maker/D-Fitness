"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, ExternalLink, Play, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { resolveExerciseTutorial } from "@/lib/workout/video-tutorials";
import { ExerciseStickmanCanvas } from "@/components/workout/exercise-stickman-canvas";
import { cn } from "@/lib/utils";

type ExerciseProps = {
  id?: number | string | null;
  name: string;
  primary_muscle?: string | null;
  secondary_muscles?: string[] | null;
  equipment?: string | null;
  video_url?: string | null;
};

type Props = {
  exercise: ExerciseProps;
  trigger?: React.ReactNode;
  className?: string;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ExerciseVideoModal({ exercise, trigger, className }: Props) {
  const [open, setOpen] = useState(false);
  const tutorial = resolveExerciseTutorial(exercise.name, exercise.video_url);

  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.name + " exercise form tutorial")}`;

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className={cn("inline-block cursor-pointer", className)}>
          {trigger}
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className={cn("flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10 select-none", className)}
        >
          <Play className="size-4 fill-primary text-primary" />
          <span>Lihat Animasi & Teknik</span>
        </Button>
      )}

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Panduan Gerakan: ${exercise.name}`}
        wide
      >
        <div className="flex flex-col gap-4">
          {/* Header Metadata & Muscle Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {exercise.primary_muscle && <Badge>{cap(exercise.primary_muscle)}</Badge>}
              {exercise.equipment && <Badge variant="muted">{cap(exercise.equipment)}</Badge>}
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <Sparkles className="size-3" /> Animasi Biomekanik
              </span>
            </div>

            <a
              href={searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <span>Cari di YouTube</span>
              <ExternalLink className="size-3.5" />
            </a>
          </div>

          {/* Interactive Biomechanical Stickman Canvas Animation (100% Offline, No YouTube Embed) */}
          {open && (
            <ExerciseStickmanCanvas exercise={exercise} heightClass="h-64 sm:h-72" />
          )}

          {/* Key Form Technique Cues */}
          <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-3.5">
            <h3 className="font-display text-sm font-bold tracking-tight flex items-center gap-1.5 text-foreground">
              <span>Panduan Teknik & Eksekusi Gerakan</span>
            </h3>

            {/* 1. Setup & Posisi Awal */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                <span>1. Setup & Posisi Awal</span>
              </h4>
              <ul className="space-y-1 pl-5 text-xs text-foreground/90 list-disc leading-relaxed">
                {tutorial.formCues.setup.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>

            {/* 2. Eksekusi Gerakan */}
            <div className="space-y-1.5 pt-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ChevronRight className="size-3.5 text-primary" />
                <span>2. Eksekusi & Pernapasan</span>
              </h4>
              <ul className="space-y-1 pl-5 text-xs text-foreground/90 list-disc leading-relaxed">
                {tutorial.formCues.execution.map((e, idx) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>
            </div>

            {/* 3. Kesalahan Umum yang Harus Dihindari */}
            <div className="space-y-1.5 pt-1 border-t border-border/50">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-amber-500" />
                <span>3. Kesalahan Umum yang Harus Dihindari</span>
              </h4>
              <ul className="space-y-1 pl-5 text-xs text-muted-foreground list-disc leading-relaxed">
                {tutorial.formCues.mistakes.map((m, idx) => (
                  <li key={idx}>{m}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom Close Button */}
          <div className="flex justify-between items-center pt-1">
            <span className="text-xs text-muted-foreground">
              Animasi vektor 60 FPS · 0 KB data eksternal
            </span>
            <Button variant="outline" onClick={() => setOpen(false)} className="px-5">
              Tutup
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
