export const dynamic = "force-dynamic";

export async function GET() {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.messagingSenderId || !firebaseConfig.appId) {
    return new Response("Firebase Messaging is not configured.", { status: 503 });
  }
  const configuration = JSON.stringify(firebaseConfig);
  const script = `
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");
firebase.initializeApp(${configuration});
const messaging = firebase.messaging();
messaging.onBackgroundMessage(({ data }) => {
  if (!data || !data.body) return;
  self.registration.showNotification(data.title || "LynoraLink", {
    body: data.body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    data: { link: data.link || "/dashboard" },
  });
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.link || "/dashboard", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin) && "navigate" in client) {
        client.focus();
        return client.navigate(destination);
      }
    }
    return self.clients.openWindow(destination);
  }));
});
`;
  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Service-Worker-Allowed": "/",
    },
  });
}
