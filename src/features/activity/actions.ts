"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { activitySchema } from "@/lib/validations/activity";
import { getProfileAndSettings } from "@/features/profile/queries";
import { afterActivityLogged, deleteActivity, logActivity, updateActivity } from "@/features/activity/service";
import { todayInTimeZone } from "@/utils/date";

const refresh = () => {
  revalidatePath("/activity", "layout");
  revalidatePath("/workout", "layout");
  revalidatePath("/dashboard");
};

export async function saveActivityAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const v = activitySchema.parse(input);
    const id = v.id ? (await updateActivity({ ...v, id: v.id }), v.id) : await logActivity(user.id, v);
    const { profile } = await getProfileAndSettings(user.id);
    await afterActivityLogged(id, v.date, todayInTimeZone(profile?.timezone ?? "UTC"));
    refresh();
    return { id };
  });
}

export async function deleteActivityAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await deleteActivity(z.string().uuid().parse(id));
    refresh();
  });
}
