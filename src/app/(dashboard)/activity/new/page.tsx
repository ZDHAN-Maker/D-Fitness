import type { Metadata } from "next";
import { ActivityForm } from "@/components/activity/activity-form";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { getActivityTypes } from "@/features/activity/service";
import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/utils/date";

export const metadata: Metadata = { title: "Log activity" };

export default async function NewActivityPage() {
  const user = await requireUser();
  const { profile } = await getProfileAndSettings(user.id);
  const supabase = await createClient();
  const [types, w] = await Promise.all([getActivityTypes(), supabase.from("weight_logs").select("weight_kg").order("logged_on", { ascending: false }).limit(1).maybeSingle()]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Log activity</h1>
      <ActivityForm types={types} latestWeightKg={w.data ? Number(w.data.weight_kg) : null} initial={{ date: todayInTimeZone(profile?.timezone ?? "UTC"), duration: "", distance: "", calories: "", notes: "" }} />
    </section>
  );
}
