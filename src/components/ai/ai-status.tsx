"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postAi } from "@/components/ai/ai-client";

type Check = { ok: boolean; kind: string; message: string };

/** Token-free check of the key: lists one model. Shows the provider's verdict in plain words; never shows the key. */
export function AiStatusCheck({ canCheck }: { canCheck: boolean }) {
  const [result, setResult] = useState<Check>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" size="sm" className="w-fit" disabled={pending || !canCheck} onClick={() => startTransition(async () => {
        setError(undefined);
        const res = await postAi<Check>("/api/ai/status", {});
        if (!res.ok) return setError(res.error);
        setResult(res.data);
      })}>
        {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Check AI connection
      </Button>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {result ? <p role={result.ok ? "status" : "alert"} className={`text-sm font-medium ${result.ok ? "text-fiber" : "text-destructive"}`}>{result.message}</p> : null}
    </div>
  );
}
