"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bot, Loader2, SendHorizonal, ShieldAlert, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postAi } from "@/components/ai/ai-client";
import type { ChatMessage } from "@/features/ai/coach";
import { cn } from "@/lib/utils";

const SUGGESTIONS = ["How was my training this week?", "Am I eating enough protein?", "Should I train hard today?", "What should I focus on next week?"];

function AssistantExtras({ m }: { m: ChatMessage }) {
  const meta = m.meta;
  return (
    <div className="mt-3 flex flex-col gap-3 text-sm">
      {meta.recommendations?.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommendations</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{meta.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      ) : null}
      {meta.missing_data?.length ? (
        <div className="rounded-md bg-muted p-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data not available</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">{meta.missing_data.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      ) : null}
      {meta.needs_professional ? (
        <p className="flex items-start gap-2 rounded-md border border-carbs/50 bg-carbs/10 p-2"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-carbs" aria-hidden="true" /> Consider talking to a qualified healthcare professional about this.</p>
      ) : null}
      {meta.factsSummary?.length ? (
        <details className="text-muted-foreground">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide">Your data used</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{meta.factsSummary.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </details>
      ) : null}
    </div>
  );
}

export function CoachChat({ initial, disabled }: { initial: { id: string; messages: ChatMessage[] } | null; disabled: boolean }) {
  const [conversationId, setConversationId] = useState<string | undefined>(initial?.id);
  const [messages, setMessages] = useState<ChatMessage[]>(initial?.messages ?? []);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages.length, pending]);

  const send = (message: string) => {
    const q = message.trim();
    if (!q || pending) return;
    setError(undefined);
    startTransition(async () => {
      const res = await postAi<{ conversationId: string; messages: ChatMessage[] }>("/api/ai/coach", { message: q, conversationId });
      if (!res.ok) return setError(res.error); // the question stays in the box so it can be retried
      setConversationId(res.data.conversationId);
      setMessages((m) => [...m, ...res.data.messages]);
      setText("");
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Ask about your training, food, sleep or goals. Answers use your own logged data.</p>
        {messages.length ? <Button type="button" variant="ghost" size="sm" onClick={() => { setMessages([]); setConversationId(undefined); setError(undefined); }}><SquarePen /> New chat</Button> : null}
      </div>

      <ol className="flex min-h-48 flex-col gap-3" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 ? (
          <li className="rounded-lg border border-dashed p-6 text-center">
            <Bot className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 font-medium">What would you like to know?</p>
            <ul className="mt-3 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => <li key={s}><button type="button" disabled={disabled || pending} onClick={() => send(s)} className="rounded-full border bg-card px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50">{s}</button></li>)}
            </ul>
          </li>
        ) : null}
        {messages.map((m) => (
          <li key={m.id} className={cn("max-w-[92%] rounded-2xl px-4 py-3", m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start border bg-card")}>
            <p className="whitespace-pre-line text-sm">{m.content}</p>
            {m.role === "assistant" ? <AssistantExtras m={m} /> : null}
          </li>
        ))}
        {pending ? <li className="flex items-center gap-2 self-start text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Thinking…</li> : null}
        <div ref={end} />
      </ol>

      {error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <label htmlFor="coach-input" className="sr-only">Your question</label>
        <textarea id="coach-input" rows={2} maxLength={1000} value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} placeholder={disabled ? "AI is not switched on yet" : "Ask your coach…"} className="min-h-12 flex-1 resize-none rounded-md border border-input bg-card px-3 py-2 text-base disabled:opacity-60 md:text-sm" />
        <Button type="submit" size="icon" disabled={disabled || pending || !text.trim()} aria-label="Send">{pending ? <Loader2 className="animate-spin" /> : <SendHorizonal />}</Button>
      </form>
    </div>
  );
}
