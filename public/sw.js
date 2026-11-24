// Service Worker for D'GYM Mobile Web Push Notifications
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "D'GYM - Fitness OS",
    body: "Ada pengingat baru untuk Anda!",
    url: "/notifications",
    tag: "dgym-notification",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: "/icon",
    badge: "/icon",
    vibrate: data.vibrate || [500, 200, 500, 200, 500, 200, 800, 200, 800],
    requireInteraction: data.requireInteraction !== undefined ? data.requireInteraction : true,
    silent: false,
    sound: data.sound || "/sounds/alarm.wav",
    actions: data.actions || [
      { action: "open", title: "Buka D'GYM" },
      { action: "close", title: "Tutup" },
    ],
    data: {
      url: data.url || "/notifications",
      dateOfArrival: Date.now(),
    },
    tag: data.tag || "dgym-reminder",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") {
    return;
  }

  const targetUrl = event.notification.data?.url || "/notifications";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open, focus it and navigate
      for (const client of windowClients) {
        if ("focus" in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

