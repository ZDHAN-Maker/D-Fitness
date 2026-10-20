"use client";

import { Button } from "@/components/ui/button";

/** Shown when a dashboard page throws. Never prints the underlying error. */
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-bold">We could not load this page</h1>
      <p className="text-sm text-muted-foreground">
        This is usually temporary. If it keeps happening, check that the database migrations have been applied.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
