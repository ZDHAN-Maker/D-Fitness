"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, CheckCircle2, Info, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subscribePushAction, unsubscribePushAction, sendTestPushAction } from "@/features/notifications/actions";
import { urlB64ToUint8Array } from "@/lib/notifications/push-utils";

export function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [testLoading, setTestLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  useEffect(() => {
    // Detect iOS and Standalone PWA state
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsIOS(iosDevice);
    setIsStandalone(standaloneMode);

    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setIsSupported(false);
      setLoading(false);
      return;
    }

    setPermission(Notification.permission);

    // Register service worker and check existing subscription
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        return registration.pushManager.getSubscription();
      })
      .then((subscription) => {
        setIsSubscribed(Boolean(subscription));
      })
      .catch((err) => {
        console.error("[push] Failed to inspect service worker subscription:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleToggle = async () => {
    setFeedback(null);
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;

      if (isSubscribed) {
        // Unsubscribe
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await unsubscribePushAction(subscription.endpoint);
        }
        setIsSubscribed(false);
        setFeedback({ ok: true, message: "Push notifikasi ke perangkat HP ini berhasil dinonaktifkan." });
      } else {
        // Request Permission
        const perm = await Notification.requestPermission();
        setPermission(perm);

        if (perm !== "granted") {
          setFeedback({
            ok: false,
            message: "Izin notifikasi ditolak di browser. Silakan aktifkan izin notifikasi di pengaturan browser HP Anda.",
          });
          setLoading(false);
          return;
        }

        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          setFeedback({
            ok: false,
            message: "Kunci VAPID public belum dikonfigurasi pada server.",
          });
          setLoading(false);
          return;
        }

        const convertedVapidKey = urlB64ToUint8Array(vapidPublicKey);
        const newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as unknown as BufferSource,
        });

        const json = newSubscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          throw new Error("Format subscription push tidak lengkap.");
        }

        const res = await subscribePushAction(
          {
            endpoint: json.endpoint,
            keys: {
              p256dh: json.keys.p256dh,
              auth: json.keys.auth,
            },
          },
          navigator.userAgent
        );

        if (!res.ok) {
          throw new Error(res.error || "Gagal menyimpan subscription ke server.");
        }

        setIsSubscribed(true);
        setFeedback({
          ok: true,
          message: "🎉 Berhasil! HP Anda kini akan menerima notifikasi pengingat latihan & nutrisi.",
        });
      }
    } catch (err: unknown) {
      console.error("[push] Error toggling push subscription:", err);
      setFeedback({
        ok: false,
        message: err instanceof Error ? err.message : "Terjadi kesalahan saat mengatur push notifikasi.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    setFeedback(null);
    setTestLoading(true);
    try {
      const res = await sendTestPushAction();
      if (!res.ok) {
        setFeedback({
          ok: false,
          message: res.error || "Gagal mengirim notifikasi uji coba.",
        });
      } else if (res.data.sent > 0) {
        setFeedback({
          ok: true,
          message: "🔥 Notifikasi uji coba terkirim! Periksa status bar atau layar kunci HP Anda.",
        });
      } else {
        setFeedback({
          ok: false,
          message: "Belum ada perangkat HP yang terdaftar untuk menerima notifikasi. Aktifkan notifikasi terlebih dahulu.",
        });
      }
    } catch {
      setFeedback({
        ok: false,
        message: "Terjadi kesalahan saat memicu notifikasi uji coba.",
      });
    } finally {
      setTestLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        <Info className="size-5 shrink-0 text-amber-400 mt-0.5" />
        <div>
          <p className="font-semibold">Browser ini belum mendukung Push Notifikasi</p>
          <p className="text-xs text-amber-300/80 mt-1">
            Gunakan browser modern seperti Google Chrome, Microsoft Edge, atau Firefox di HP Anda untuk mengaktifkan notifikasi langsung ke HP.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Smartphone className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              Push Notifikasi HP
              {isSubscribed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                  <CheckCircle2 className="size-3" /> Aktif di HP Ini
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                  Belum Aktif
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Terima pemberitahuan langsung di status bar dan layar kunci HP Anda (pengingat jadwal latihan, target air minum, gap protein).
            </p>
          </div>
        </div>
      </div>

      {isIOS && !isStandalone && (
        <div className="flex items-start gap-2.5 rounded-md border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-200">
          <Info className="size-4 shrink-0 text-sky-400 mt-0.5" />
          <div>
            <span className="font-semibold block">Petunjuk untuk Pengguna iPhone / iPad:</span>
            Apple mewajibkan aplikasi web ditambahkan ke Layar Utama terlebih dahulu. Buka menu <strong>Share</strong> (ikon panah ke atas) di Safari, lalu ketuk <strong>&quot;Tambah ke Layar Utama&quot; (Add to Home Screen)</strong>.
          </div>
        </div>
      )}

      {permission === "denied" && (
        <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <BellOff className="size-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Izin Notifikasi Diblokir di Browser</span>
            Anda sebelumnya menolak izin notifikasi di browser HP ini. Buka setelan browser (ikon gembok di bilah alamat atau Pengaturan Situs) dan ubah izin Notifikasi menjadi <strong>Izinkan (Allow)</strong>.
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-start gap-2.5 rounded-md p-3 text-xs border ${
            feedback.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.ok ? <CheckCircle2 className="size-4 shrink-0 mt-0.5" /> : <Info className="size-4 shrink-0 mt-0.5" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <Button
          type="button"
          onClick={handleToggle}
          disabled={loading || permission === "denied"}
          variant={isSubscribed ? "outline" : "default"}
          className="cursor-pointer"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin mr-1.5" />
          ) : isSubscribed ? (
            <BellOff className="size-4 mr-1.5 text-muted-foreground" />
          ) : (
            <Bell className="size-4 mr-1.5" />
          )}
          {isSubscribed ? "Nonaktifkan di HP Ini" : "Aktifkan Push Notifikasi HP"}
        </Button>

        {isSubscribed && (
          <Button
            type="button"
            onClick={handleSendTest}
            disabled={testLoading}
            variant="secondary"
            className="cursor-pointer"
          >
            {testLoading ? (
              <Loader2 className="size-4 animate-spin mr-1.5" />
            ) : (
              <BellRing className="size-4 mr-1.5 text-amber-400" />
            )}
            Kirim Notifikasi Uji Coba ke HP
          </Button>
        )}
      </div>
    </section>
  );
}
