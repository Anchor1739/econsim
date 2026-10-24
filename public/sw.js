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

  const options = {
    body: payload.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
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

