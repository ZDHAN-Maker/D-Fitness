import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, UserSettings } from "@/types/domain";

/** Profile + settings for the signed-in user, fetched in parallel and de-duplicated per request. */
export const getProfileAndSettings = cache(async (userId: string) => {
  const supabase = await createClient();
  const [profileRes, settingsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  if (profileRes.error) {
    if (profileRes.error.code === "PGRST205") {
      throw new Error(
        "Tabel database belum dibuat di project Supabase Anda. Silakan jalankan script 'supabase/setup_remote_database.sql' di Supabase SQL Editor."
      );
    }
    throw profileRes.error;
  }
  if (settingsRes.error) {
    if (settingsRes.error.code === "PGRST205") {
      throw new Error(
        "Tabel database belum dibuat di project Supabase Anda. Silakan jalankan script 'supabase/setup_remote_database.sql' di Supabase SQL Editor."
      );
    }
    throw settingsRes.error;
  }

  let profile = (profileRes.data ?? null) as Profile | null;
  let settings = (settingsRes.data ?? null) as UserSettings | null;

  // Auto-bootstrap profile & settings if missing for this user
  if (!profile || !settings) {
    try {
      const admin = createAdminClient();
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email ?? "";
      const displayName =
        userData?.user?.user_metadata?.display_name ||
        userData?.user?.user_metadata?.full_name ||
        email.split("@")[0] ||
        "Athlete";

      if (!profile) {
        const { data: createdProfile } = await admin
          .from("profiles")
          .upsert({ id: userId, display_name: displayName })
          .select("*")
          .single();
        if (createdProfile) profile = createdProfile as Profile;
      }

      if (!settings) {
        const { data: createdSettings } = await admin
          .from("user_settings")
          .upsert({ user_id: userId })
          .select("*")
          .single();
        if (createdSettings) settings = createdSettings as UserSettings;
      }

      await Promise.allSettled([
        admin.from("user_preferences").upsert({ user_id: userId }),
        admin.from("notification_preferences").upsert({ user_id: userId }),
        admin.from("streaks").upsert(
          [
            { user_id: userId, streak_type: "workout" },
            { user_id: userId, streak_type: "nutrition" },
            { user_id: userId, streak_type: "hydration" },
            { user_id: userId, streak_type: "habit" },
          ],
          { onConflict: "user_id,streak_type" }
        ),
      ]);
    } catch {
      // Best-effort auto-healing
    }
  }

  return {
    profile,
    settings,
  };
});
