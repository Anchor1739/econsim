// EconSim Unified Service Worker — PWA Offline Shell, Web Push & FCM
const CACHE_NAME = 'econsim-pwa-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/css/app.css',
  '/css/driver.css',
  '/js/api.js',
  '/js/app.js',
  '/js/driver.js',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching asset notice:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

// Required for PWA installation criteria
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and skip API endpoints
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/');
          }
        });
      })
  );
});

const DEFAULT_ICON = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23059669"/><text y=".75em" x="20" font-size="70" fill="white">↗</text></svg>';

// Handle incoming Web Push notifications (Standard Web Push or background sync)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'EconSim Strategic Alert',
    body: 'New market catalyst or boardroom dilemma.',
    url: '/',
    tag: 'econsim-alert-' + Date.now(),
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
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_ICON,
    tag: payload.tag || 'econsim-alert',
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || (payload.target_page ? `/?page=${payload.target_page}` : '/'),
      target_page: payload.target_page || 'dashboard',
      target_id: payload.target_id || null,
      timestamp: Date.now()
    },
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

// Optional Firebase compat integration inside service worker
try {
  importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging-compat.js');

  const firebaseConfig = {
    apiKey: "AIzaSyBmZmh42Uaiej1vS5sWzQz3-rHCveOTgxg",
    authDomain: "developing-market.firebaseapp.com",
    projectId: "developing-market",
    storageBucket: "developing-market.firebasestorage.app",
    messagingSenderId: "392154141323",
    appId: "1:392154141323:web:4e251cdb893958450fba8e",
    measurementId: "G-97Z6709G0Q"
  };

  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Firebase background push received:', payload);
    const title = payload.notification?.title || payload.data?.title || 'EconSim Strategic Alert';
    const body = payload.notification?.body || payload.data?.body || 'New boardroom match or predictor event.';
    const notifUrl = payload.data?.url || (payload.data?.target_page ? `/?page=${payload.data.target_page}` : '/');

    return self.registration.showNotification(title, {
      body: body,
      icon: payload.notification?.icon || payload.data?.icon || DEFAULT_ICON,
      badge: payload.notification?.icon || payload.data?.icon || DEFAULT_ICON,
      tag: payload.data?.tag || 'econsim-fcm-' + Date.now(),
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: notifUrl }
    });
  });
} catch (e) {
  // Offline or Firebase script load skipped; standard push and PWA work uninterrupted
}
