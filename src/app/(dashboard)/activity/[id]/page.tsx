import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActivityForm } from "@/components/activity/activity-form";
import { requireUser } from "@/lib/auth/session";
import { getActivity, getActivityTypes } from "@/features/activity/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit activity" };

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const supabase = await createClient();
  const [activity, types, w] = await Promise.all([getActivity(id.data), getActivityTypes(), supabase.from("weight_logs").select("weight_kg").order("logged_on", { ascending: false }).limit(1).maybeSingle()]);
  if (!activity) notFound();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Edit activity</h1>
      <ActivityForm
        types={types}
        latestWeightKg={w.data ? Number(w.data.weight_kg) : null}
        initial={{ id: activity.id, activityTypeId: activity.activity_type_id, date: activity.logged_on, duration: String(activity.duration_minutes), distance: activity.distance_km ? String(activity.distance_km) : "", calories: activity.calories_burned ? String(activity.calories_burned) : "", notes: activity.notes ?? "" }}
      />
    </section>
  );
}
