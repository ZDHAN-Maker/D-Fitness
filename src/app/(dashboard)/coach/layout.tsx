import { AiBanner, AiDisclaimer } from "@/components/ai/ai-banner";
import { CoachTabs } from "@/components/ai/coach-tabs";
import { tryGetAiConfig } from "@/lib/ai/config";
import { getUsage } from "@/lib/ai/usage";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const cfg = tryGetAiConfig();
  const usage = await getUsage().catch(() => null);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold md:text-4xl">AI Coach</h1>
        <CoachTabs />
      </header>
      <AiBanner configured={cfg.configured} missing={cfg.missing} hasKey={Boolean(cfg.apiKey)} usage={usage} limits={{ daily: cfg.dailyLimit, vision: cfg.visionDailyLimit }} />
      {children}
      <AiDisclaimer />
    </div>
  );
}
