// Developing Market - Firebase App, Analytics & Cloud Messaging (FCM) Integration
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-analytics.js";
import { 
  getMessaging, 
  getToken, 
  onMessage, 
  isSupported 
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging.js";

// Web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyBmZmh42Uaiej1vS5sWzQz3-rHCveOTgxg",
  authDomain: "developing-market.firebaseapp.com",
  projectId: "developing-market",
  storageBucket: "developing-market.firebasestorage.app",
  messagingSenderId: "392154141323",
  appId: "1:392154141323:web:4e251cdb893958450fba8e",
  measurementId: "G-97Z6709G0Q"
};

const DEFAULT_ICON = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23059669"/><text y=".75em" x="20" font-size="70" fill="white">↗</text></svg>';

let app = null;
let analytics = null;
let messaging = null;
let swRegistration = null;

try {
  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    // Analytics is non-critical / may be disabled in private browsing
  }
} catch (e) {
  console.warn('[Firebase] Initialization notice:', e);
}

/**
 * Initializes Firebase Cloud Messaging service worker and listeners
 */
export async function initFirebaseMessaging() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    console.log('[Firebase FCM] Web push notifications not supported in this browser environment.');
    return null;
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    console.log('[Firebase FCM] Firebase messaging is not supported in this browser.');
    return null;
  }

  try {
    // Register the dedicated Firebase Messaging Service Worker
    swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    console.log('[Firebase FCM] Service Worker registered successfully:', swRegistration.scope);

    messaging = getMessaging(app);

    // Setup foreground message receiver (triggers native OS notification popup + in-app toast)
    onMessage(messaging, (payload) => {
      console.log('[Firebase FCM] Foreground push received:', payload);

      const title = payload.notification?.title || payload.data?.title || 'Developing Market Alert';
      const body = payload.notification?.body || payload.data?.body || 'New financial market update.';
      const notifUrl = payload.data?.url || (payload.data?.target_page ? `/?page=${payload.data.target_page}` : '/');

      // 1. Native Desktop/Mobile OS Popup Notification
      if (Notification.permission === 'granted') {
        try {
          if (swRegistration && swRegistration.showNotification) {
            swRegistration.showNotification(title, {
              body: body,
              icon: DEFAULT_ICON,
              badge: DEFAULT_ICON,
              tag: 'econsim-fcm-' + Date.now(),
              renotify: true,
              vibrate: [150, 75, 150],
              data: { url: notifUrl }
            });
          } else {
            const n = new Notification(title, {
              body: body,
              icon: DEFAULT_ICON
            });
            n.onclick = () => {
              window.focus();
              if (window.navigate && payload.data?.target_page) {
                window.navigate(payload.data.target_page);
              }
            };
          }
        } catch (e) {
          console.warn('[Firebase FCM] Native notification popup error:', e);
        }
      }

      // 2. In-App Notification Center & Toast
      if (typeof window.sendSystemNotification === 'function') {
        window.sendSystemNotification(
          title,
          body,
          payload.data?.target_page || 'dashboard',
          payload.data?.target_id || null,
          payload.data?.category || 'market'
        );
      }
    });

    // If permission was already granted previously, automatically retrieve FCM token
    if (Notification.permission === 'granted') {
      requestFcmToken().catch(() => {});
    }

    return messaging;
  } catch (err) {
    console.warn('[Firebase FCM] Setup error:', err);
    return null;
  }
}

/**
 * Requests notification permission from user and retrieves Firebase Device Token
 */
export async function requestFcmToken() {
  if (!('Notification' in window)) {
    throw new Error('Notifications not supported');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permission not granted');
  }

  if (!messaging) {
    await initFirebaseMessaging();
  }

  try {
    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.ready;
    }

    const tokenOptions = {
      serviceWorkerRegistration: swRegistration
    };

    // Retrieve FCM Device Registration Token
    const currentToken = await getToken(messaging, tokenOptions);
    if (currentToken) {
      console.log('[Firebase FCM] Device Registration Token obtained:', currentToken.substring(0, 20) + '...');
      localStorage.setItem('econsim-fcm-token', currentToken);

      // Persist to backend so server can send targeted notifications to this user
      if (window.api && typeof window.api.post === 'function') {
        window.api.post('/profile/fcm-token', { fcm_token: currentToken }).catch(() => {});
      }

      return currentToken;
    } else {
      console.warn('[Firebase FCM] No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.warn('[Firebase FCM] getToken notice:', err);
    // Even if VAPID key is pending on Firebase console, native web push & SW remain fully operational
    return null;
  }
}

// Expose on global window object for app.js interoperability
window.EconSimFirebase = {
  app,
  analytics,
  initFirebaseMessaging,
  requestFcmToken
};
window.requestFcmToken = requestFcmToken;

// Automatically initialize messaging when window finishes loading
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initFirebaseMessaging().catch(() => {});
  });
} else {
  initFirebaseMessaging().catch(() => {});
}
