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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const route = event.notification.data && event.notification.data.route;
  if (typeof route !== "string" || !route.startsWith("/") || route.startsWith("//")) return;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if ("focus" in client) {
        client.navigate(route);
        return client.focus();
      }
    }
    return self.clients.openWindow(route);
  }));
});
