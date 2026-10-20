import { AppShell } from "@/components/dashboard/app-shell";
import { NotificationSync } from "@/components/notifications/notification-sync";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { unreadCount } from "@/features/notifications/service";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [{ profile }, unread] = await Promise.all([getProfileAndSettings(user.id), unreadCount().catch(() => 0)]);
  const displayName = profile?.display_name ?? user.email?.split("@")[0] ?? "Athlete";
  return (
    <AppShell displayName={displayName} unreadCount={unread}>
      {children}
      <NotificationSync />
    </AppShell>
  );
}
