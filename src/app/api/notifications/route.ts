import { jsonError, jsonOk } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/guard";
import { listNotifications, unreadCount } from "@/features/notifications/service";

export const dynamic = "force-dynamic";

/** GET /api/notifications — newest first, with the unread count. */
export async function GET() {
  try {
    await requireApiUser();
    const [items, unread] = await Promise.all([listNotifications(50), unreadCount()]);
    return jsonOk({ items, unread });
  } catch (err) {
    return jsonError(err);
  }
}
