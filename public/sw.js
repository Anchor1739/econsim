// Developing Market Service Worker - Web Push Notifications & Background Sync
const CACHE_NAME = 'econsim-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle incoming Web Push notifications from server or background events
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Developing Market Alert',
    body: 'New market event or boardroom challenge update.',
    url: '/',
    tag: 'econsim-alert',
  };

  try {
    if (event.data) {
      payload = Object.assign(payload, event.data.json());
    }
  } catch (e) {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  const iconSvg = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23059669"/><text y=".75em" x="20" font-size="70" fill="white">↗</text></svg>';

  const options = {
    body: payload.body,
    icon: payload.icon || iconSvg,
    badge: payload.badge || iconSvg,
    tag: payload.tag || 'econsim-alert',
    renotify: true,
    data: {
      url: payload.url || '/',
      target_page: payload.target_page || 'dashboard',
      target_id: payload.target_id || null,
    },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open in Arena ↗' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Handle notification click and deep link directly into the application
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

