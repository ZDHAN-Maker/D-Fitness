"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { notificationPrefsSchema } from "@/lib/validations/goals";
import { getProfileAndSettings } from "@/features/profile/queries";
import { syncProgress } from "@/features/goals/service";
import { deleteNotification, generateNotifications, markAllRead, markRead, savePrefs } from "@/features/notifications/service";
import { todayInTimeZone } from "@/utils/date";

const refresh = () => {
  revalidatePath("/notifications", "layout");
  revalidatePath("/dashboard");
};

export async function markReadAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await markRead(z.string().uuid().parse(id));
    refresh();
  });
}

export async function markAllReadAction(): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await markAllRead();
    refresh();
  });
}

export async function deleteNotificationAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await deleteNotification(z.string().uuid().parse(id));
    refresh();
  });
}

export async function savePrefsAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    await savePrefs(user.id, notificationPrefsSchema.parse(input));
    refresh();
  });
}

export type SyncOutcome = { created: number; goalsCompleted: string[]; achievements: string[]; changed: boolean };

/**
 * Called (throttled) when the app is opened: refreshes goals/streaks/achievements and creates any contextual
 * notifications that apply right now. Cheap when there is nothing to do; never throws into the UI.
 */
export async function syncAppStateAction(): Promise<ActionResult<SyncOutcome>> {
  return runAction(async () => {
    const user = await requireUser();
    const { profile } = await getProfileAndSettings(user.id);
    const sync = await syncProgress(todayInTimeZone(profile?.timezone ?? "UTC"));
    const gen = await generateNotifications(user.id);
    const changed = sync.goalsUpdated > 0 || sync.goalsCompleted.length > 0 || sync.achievements.length > 0 || gen.created > 0;
    if (changed) refresh();
    return { created: gen.created, goalsCompleted: sync.goalsCompleted, achievements: sync.achievements, changed };
  });
}
