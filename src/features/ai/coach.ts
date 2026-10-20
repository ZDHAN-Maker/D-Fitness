import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { runAi } from "@/lib/ai/run";
import { coachGemini, coachZod, type CoachOutput } from "@/lib/ai/schemas";
import { COACH_SYSTEM, INSIGHT_SYSTEM, dataBlock } from "@/lib/ai/prompts";
import { CANNED, OUTPUT_BLOCKED, classifyMessage, clampText, violatesCalorieFloor } from "@/lib/ai/safety";
import { describeFacts, factsForModel } from "@/lib/ai/facts";
import { buildCoachFacts } from "@/features/ai/facts";
import type { GeminiContent } from "@/lib/ai/gemini";

export type CoachMeta = { recommendations: string[]; missing_data: string[]; needs_professional: boolean; factsSummary: string[]; safety?: string; model?: string };
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string; meta: Partial<CoachMeta> };

const toMessage = (r: Record<string, unknown>): ChatMessage => ({ id: String(r.id), role: r.role as "user" | "assistant", content: String(r.content), createdAt: String(r.created_at), meta: (r.metadata as Partial<CoachMeta>) ?? {} });

/** The server-side safety pass over a model answer. Pure, so it is unit-tested. */
export function guardAnswer(out: CoachOutput, userMessageClass: string): { answer: string; recommendations: string[]; needsProfessional: boolean; blocked: boolean } {
  const text = [out.answer, ...out.recommendations].join("\n");
  if (violatesCalorieFloor(text)) return { answer: OUTPUT_BLOCKED, recommendations: [], needsProfessional: true, blocked: true };
  return { answer: clampText(out.answer, 3000), recommendations: out.recommendations.map((r) => clampText(r, 400)), needsProfessional: out.needs_professional || userMessageClass === "medical", blocked: false };
}

export async function askCoach(userId: string, input: { conversationId?: string; message: string }) {
  const supabase = await createClient();
  const cls = classifyMessage(input.message);

  let conversationId = input.conversationId;
  let history: GeminiContent[] = [];
  if (conversationId) {
    const { data: conv, error } = await supabase.from("ai_conversations").select("id").eq("id", conversationId).maybeSingle();
    if (error) throw error;
    if (!conv) throw new AppError("not_found", "That conversation no longer exists.", 404);
    const { data: msgs, error: mErr } = await supabase.from("ai_messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(8);
    if (mErr) throw mErr;
    history = (msgs ?? []).reverse().map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] }));
  }

  let answer: string;
  let meta: CoachMeta;

  if (cls === "emergency" || cls === "eating_disorder" || cls === "extreme_restriction") {
    // Answered locally: no model call, no cost, no chance of a harmful reply.
    answer = CANNED[cls];
    meta = { recommendations: [], missing_data: [], needs_professional: cls !== "extreme_restriction", factsSummary: [], safety: cls };
  } else {
    const facts = await buildCoachFacts(userId);
    const { data, model } = await runAi({
      userId,
      feature: "coach",
      system: COACH_SYSTEM,
      contents: [...history, { role: "user", parts: [{ text: dataBlock(factsForModel(facts), input.message) }] }],
      schema: coachGemini,
      validate: (raw) => coachZod.parse(raw),
    });
    const g = guardAnswer(data, cls);
    answer = g.answer;
    // `missing_data` = what the model says it could not find FOR THIS QUESTION (the full gap list went to the model in <data>);
    // `factsSummary` = the user's real numbers, written by the server, never by the model.
    meta = { recommendations: g.recommendations, missing_data: data.missing_data, needs_professional: g.needsProfessional, factsSummary: describeFacts(facts), model, ...(g.blocked ? { safety: "output_blocked" } : {}) };
  }

  // Persist only after a successful answer, so a failed request never leaves a dangling question.
  if (!conversationId) {
    const { data: conv, error } = await supabase.from("ai_conversations").insert({ user_id: userId, feature: "coach", title: clampText(input.message, 60) }).select("id").single();
    if (error) throw error;
    conversationId = conv.id as string;
  }
  const { data: rows, error: insErr } = await supabase
    .from("ai_messages")
    .insert([
      { conversation_id: conversationId, role: "user", content: input.message },
      { conversation_id: conversationId, role: "assistant", content: answer, metadata: meta },
    ])
    .select("id, role, content, created_at, metadata");
  if (insErr) throw insErr;
  await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

  const messages = (rows ?? []).map(toMessage).sort((a, b) => (a.role === b.role ? 0 : a.role === "user" ? -1 : 1));
  return { conversationId, messages };
}

export async function getLatestConversation(): Promise<{ id: string; messages: ChatMessage[] } | null> {
  const supabase = await createClient();
  const { data: conv, error } = await supabase.from("ai_conversations").select("id").eq("feature", "coach").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!conv) return null;
  const { data: msgs, error: mErr } = await supabase.from("ai_messages").select("id, role, content, created_at, metadata").eq("conversation_id", conv.id).order("created_at", { ascending: true }).limit(100);
  if (mErr) throw mErr;
  return { id: conv.id as string, messages: (msgs ?? []).map(toMessage) };
}

export type Insight = { text: string; recommendations: string[]; missing: string[]; factsSummary: string[]; createdAt: string };

export async function getTodayInsight(date: string): Promise<Insight | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_insights").select("recommendation, facts, missing_data, created_at").eq("insight_date", date).eq("kind", "daily").maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const f = (data.facts as { summary?: string[]; recommendations?: string[] }) ?? {};
  return { text: String(data.recommendation), recommendations: f.recommendations ?? [], missing: (data.missing_data as string[]) ?? [], factsSummary: f.summary ?? [], createdAt: String(data.created_at) };
}

/** One short daily insight per day (regenerating replaces it). Facts and the model's text are stored separately. */
export async function generateInsight(userId: string): Promise<Insight> {
  const facts = await buildCoachFacts(userId);
  const { data, model } = await runAi({
    userId,
    feature: "insight",
    system: INSIGHT_SYSTEM,
    contents: [{ role: "user", parts: [{ text: dataBlock(factsForModel(facts)) }] }],
    schema: coachGemini,
    validate: (raw) => coachZod.parse(raw),
  });
  const g = guardAnswer(data, "ok");
  const summary = describeFacts(facts);
  const supabase = await createClient();
  const row = { user_id: userId, insight_date: facts.date, kind: "daily", facts: { summary, recommendations: g.recommendations, window: facts.window }, recommendation: g.answer, missing_data: data.missing_data, model };
  const { data: saved, error } = await supabase.from("ai_insights").upsert(row, { onConflict: "user_id,insight_date,kind" }).select("created_at").single();
  if (error) throw error;
  return { text: g.answer, recommendations: g.recommendations, missing: data.missing_data, factsSummary: summary, createdAt: String(saved.created_at) };
}
