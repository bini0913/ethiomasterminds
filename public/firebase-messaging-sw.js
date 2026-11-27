/* Firebase Messaging service worker for browser push. The public Firebase
 * web config is passed as URL query parameters during registration; it is not
 * a server secret. Never put a service-account key in this file. */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const title = data.title || "Master Minds";
    const options = {
      body: data.body || "You have a new notification.",
      icon: "/brand/master-minds-icon.svg",
      badge: "/brand/master-minds-icon.svg",
      data,
      tag: data.event_id || data.message_id || data.request_id || undefined,
    };
    self.registration.showNotification(title, options);
  });
}

function isSafeInternalRoute(route) {
  return typeof route === "string"
    && route.length > 0
    && route.length <= 2048
    && route.startsWith("/")
    && !route.startsWith("//")
    && !route.includes("\\")
    && !Array.from(route).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || code === 0x7f;
    });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const route = event.notification.data && event.notification.data.route;
  if (!isSafeInternalRoute(route)) return;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existingClient = windows.find((client) => "focus" in client && "navigate" in client);
    if (existingClient) {
      await existingClient.navigate(route);
      await existingClient.focus();
      return;
    }
    await self.clients.openWindow(route);
  })());
});
