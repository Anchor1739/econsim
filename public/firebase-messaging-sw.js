// Firebase Cloud Messaging Service Worker - Background Web Push Notifications
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

const DEFAULT_ICON = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23059669"/><text y=".75em" x="20" font-size="70" fill="white">↗</text></svg>';

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);

  const title = payload.notification?.title || payload.data?.title || 'Developing Market Alert';
  const body = payload.notification?.body || payload.data?.body || 'New market catalyst or boardroom dilemma.';
  const icon = payload.notification?.icon || payload.data?.icon || DEFAULT_ICON;
  const targetUrl = payload.data?.url || (payload.data?.target_page ? `/?page=${payload.data.target_page}` : '/');

  const options = {
    body: body,
    icon: icon,
    badge: icon,
    tag: payload.data?.tag || 'econsim-fcm-' + Date.now(),
    renotify: true,
    vibrate: [150, 75, 150],
    data: {
      url: targetUrl,
      target_page: payload.data?.target_page || 'dashboard',
      target_id: payload.data?.target_id || null,
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'Open in Arena ↗' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  return self.registration.showNotification(title, options);
});

// Deep link handling on notification click
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
