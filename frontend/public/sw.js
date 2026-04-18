// SpaceSistem service worker — handles local & push notifications
// Version: v1

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Allow pages to proactively trigger notifications (used by the app after
// marking a cobrança as paid). Using SW registration ensures the notification
// is shown even if the tab is in the background.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'spacefy-notify') {
    const { title = 'SpaceSistem', options = {} } = data.payload || {};
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// Fallback for real Web Push (requires VAPID/server) — future-proof
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = data.title || 'SpaceSistem';
  const options = {
    body: data.body || '',
    icon: data.icon,
    badge: data.badge,
    tag: data.tag || 'spacefy',
    renotify: true,
    data: data.data || {}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
