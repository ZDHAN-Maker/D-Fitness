import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:uprise419@gmail.com";

if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (err) {
    console.error("[push-service] Failed to set VAPID details:", err);
  }
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type DeviceSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

/**
 * Registers or updates a device subscription for the given user.
 */
export async function saveDeviceSubscription(
  userId: string,
  sub: DeviceSubscriptionInput,
  userAgent?: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: userAgent || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) {
    console.error("[push-service] Failed to save push subscription:", error);
    if (error.code === "PGRST205") {
      return {
        ok: false,
        error:
          "Tabel push_subscriptions belum ada di database. Silakan jalankan migrasi 021_push_subscriptions.sql di Supabase SQL Editor.",
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Removes a device subscription when user disables push notifications.
 */
export async function removeDeviceSubscription(
  userId: string,
  endpoint: string
): Promise<{ ok: boolean }> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) {
    console.error("[push-service] Failed to remove push subscription:", error);
    return { ok: false };
  }

  return { ok: true };
}

/**
 * Sends a Web Push notification to all active devices registered by the user.
 * Automatically purges subscriptions that return 410 Gone or 404 Not Found.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!publicKey || !privateKey) {
    console.warn("[push-service] VAPID keys not configured; skipping push dispatch.");
    return { sent: 0, failed: 0 };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    console.warn("[push-service] Supabase admin client not available; skipping push dispatch.");
    return { sent: 0, failed: 0 };
  }

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !subs || subs.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  const stringified = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/notifications",
    tag: payload.tag || "dgym-reminder",
  });

  await Promise.all(
    subs.map(async (row) => {
      const subscription: webpush.PushSubscription = {
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth,
        },
      };

      try {
        await webpush.sendNotification(subscription, stringified);
        sent++;
      } catch (err: unknown) {
        failed++;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404 Not Found or 410 Gone means the subscription has expired or unsubscribed
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(row.id);
        } else {
          console.error(`[push-service] Error sending push to endpoint (${row.endpoint.slice(0, 30)}...):`, err);
        }
      }
    })
  );

  // Clean up any stale subscriptions
  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  return { sent, failed };
}
