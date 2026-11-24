import type { Metadata } from "next";
import { CoachChat } from "@/components/ai/coach-chat";
import { getLatestConversation } from "@/features/ai/coach";

export const metadata: Metadata = { title: "AI Coach" };

export default async function CoachPage() {
  const [conversation] = await Promise.all([getLatestConversation()]);
  return <CoachChat initial={conversation} disabled={false} />;
}
