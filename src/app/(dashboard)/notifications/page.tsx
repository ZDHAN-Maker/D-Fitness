import type { Metadata } from "next";
import { NotificationList } from "@/components/notifications/notification-list";
import { PreferencesForm } from "@/components/notifications/preferences-form";
import { requireUser } from "@/lib/auth/session";
import { getPrefs, listNotifications } from "@/features/notifications/service";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireUser();
  const [items, prefs] = await Promise.all([listNotifications(50), getPrefs()]);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-bold md:text-4xl">Notifications</h1>
      <NotificationList items={items} />
      <PreferencesForm initial={prefs} />
    </div>
  );
}
