"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";

export function FirebaseForegroundNotifications() {
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    let initializing = false;
    let unsubscribe: (() => void) | null = null;

    const startForegroundPushNotifications = async () => {
      const userId = session?.user?.id;
      if (
        initializing ||
        !userId ||
        window.localStorage.getItem("lynora.push.enabled") !== "true" ||
        !("Notification" in window) ||
        Notification.permission !== "granted" ||
        !("serviceWorker" in navigator)
      ) return;

      initializing = true;
      try {
        const config = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
        };
        if (Object.values(config).some((value) => !value)) return;

        const { getApps, initializeApp } = await import("firebase/app");
        const { getMessaging, isSupported, onMessage } = await import("firebase/messaging");
        if (!(await isSupported()) || !active) return;

        const app = getApps().find((candidate) => candidate.name === "[DEFAULT]") ?? initializeApp(config);
        const messaging = getMessaging(app);
        await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        if (
          !active ||
          window.localStorage.getItem("lynora.push.enabled") !== "true" ||
          Notification.permission !== "granted"
        ) return;

        unsubscribe?.();
        unsubscribe = onMessage(messaging, (payload) => {
          const data = payload.data;
          if (!data) return;

          if (Notification.permission === "granted") {
            const notification = new Notification(data.title || "LynoraLink", {
              body: data.body || "",
              icon: "/favicon.png",
              badge: "/favicon.png",
            });
            notification.onclick = () => {
              notification.close();
              const destination = new URL(data.link || "/dashboard", window.location.origin);
              if (destination.origin !== window.location.origin) return;
              window.focus();
              router.push(`${destination.pathname}${destination.search}${destination.hash}`);
            };
          }
          void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
        });
      } catch (error) {
        console.error("Unable to listen for foreground Firebase push notifications:", error);
      } finally {
        initializing = false;
      }
    };

    const stopForegroundPushNotifications = () => {
      unsubscribe?.();
      unsubscribe = null;
    };

    void startForegroundPushNotifications();
    window.addEventListener("lynora:push-enabled", startForegroundPushNotifications);
    window.addEventListener("lynora:push-disabled", stopForegroundPushNotifications);
    return () => {
      active = false;
      stopForegroundPushNotifications();
      window.removeEventListener("lynora:push-enabled", startForegroundPushNotifications);
      window.removeEventListener("lynora:push-disabled", stopForegroundPushNotifications);
    };
  }, [queryClient, router, session?.user?.id]);

  return null;
}
