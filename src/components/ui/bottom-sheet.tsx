"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean };

/** Minimal accessible modal sheet: ESC / backdrop to close, focus moves in, background scroll locks. */
export function BottomSheet({ open, onClose, title, children, wide = false }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center" role="presentation">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl md:rounded-2xl ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
