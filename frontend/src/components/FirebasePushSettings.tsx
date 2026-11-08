"use client";

import { useEffect, useState } from "react";
import { BellRing, LoaderCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { getNetworkErrorMessage } from "@/lib/error-messages";

type FirebaseBrowserConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function getFirebaseConfig(): FirebaseBrowserConfig | null {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
  return Object.values(config).every(Boolean) ? config : null;
}

export function FirebasePushSettings() {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || window.localStorage.getItem("lynora.push.enabled") !== "true" || Notification.permission !== "granted") return;
    let active = true;
    void (async () => {
      try {
        const config = getFirebaseConfig();
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!config || !vapidKey || !("serviceWorker" in navigator)) return;
        const { getApp, getApps, initializeApp } = await import("firebase/app");
        const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
        if (!(await isSupported())) return;
        const app = getApps().length ? getApp() : initializeApp(config);
        const messaging = getMessaging(app);
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
        if (!token || !active) return;
        const response = await fetch("/api/account/push-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "PUSH_REGISTRATION_FAILED");
        if (active) setEnabled(true);
      } catch (error) {
        console.error("Unable to restore Firebase push settings:", error);
        if (!active) return;
        const code = error instanceof Error ? error.message : "PUSH_UNKNOWN_ERROR";
        setIsError(true);
        setMessage(getNetworkErrorMessage(error, isFrench ? "fr" : "en") ?? pushErrorMessage(code, isFrench));
      }
    })();
    return () => { active = false; };
  }, [isFrench]);

  async function togglePush() {
    setBusy(true);
    setMessage("");
    setIsError(false);
    let token: string | null = null;
    try {
      if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        throw new Error("PUSH_UNSUPPORTED");
      }
      const config = getFirebaseConfig();
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!config || !vapidKey) throw new Error("PUSH_NOT_CONFIGURED");

      const { getApp, getApps, initializeApp } = await import("firebase/app");
      const { deleteToken, getMessaging, getToken, isSupported } = await import("firebase/messaging");
      if (!(await isSupported())) throw new Error("PUSH_UNSUPPORTED");
      const app = getApps().length ? getApp() : initializeApp(config);
      const messaging = getMessaging(app);
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

      if (enabled) {
        token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
        if (token) {
          const response = await fetch("/api/account/push-token", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          if (!response.ok) throw new Error("PUSH_REMOVAL_FAILED");
        }
        await deleteToken(messaging);
        window.localStorage.removeItem("lynora.push.enabled");
        window.dispatchEvent(new Event("lynora:push-disabled"));
        setEnabled(false);
        setMessage(isFrench ? "Notifications push désactivées sur cet appareil." : "Push notifications are disabled on this device.");
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("PUSH_PERMISSION_DENIED");
        token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
        if (!token) throw new Error("PUSH_TOKEN_UNAVAILABLE");
        const response = await fetch("/api/account/push-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "PUSH_REGISTRATION_FAILED");
        window.localStorage.setItem("lynora.push.enabled", "true");
        window.dispatchEvent(new Event("lynora:push-enabled"));
        setEnabled(true);
        setMessage(isFrench ? "Notifications push activées sur cet appareil." : "Push notifications are enabled on this device.");
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "PUSH_UNKNOWN_ERROR";
      setIsError(true);
      setMessage(getNetworkErrorMessage(error, isFrench ? "fr" : "en") ?? pushErrorMessage(code, isFrench));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-midnight-border bg-midnight-deep/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <BellRing size={18} className="mt-0.5 shrink-0 text-gold-soft" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold text-ink">{isFrench ? "Notifications push" : "Push notifications"}</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              {isFrench ? "Recevez les nouveaux messages et les alertes de LynoraLink dans ce navigateur." : "Receive new messages and LynoraLink alerts in this browser."}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => void togglePush()} disabled={busy} className="btn-outline min-w-32 justify-center px-3 py-2 text-xs disabled:opacity-50">
          {busy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}
          {busy ? (isFrench ? "Patientez…" : "Please wait…") : enabled ? (isFrench ? "Désactiver" : "Disable") : (isFrench ? "Activer" : "Enable")}
        </button>
      </div>
      {message && <p role={isError ? "alert" : "status"} className={`mt-3 text-xs ${isError ? "text-rose-300" : "text-emerald-300"}`}>{message}</p>}
    </section>
  );
}

function pushErrorMessage(code: string, isFrench: boolean) {
  const copy: Record<string, [string, string]> = {
    PUSH_UNSUPPORTED: ["Les notifications push ne sont pas prises en charge par ce navigateur.", "Push notifications are not supported by this browser."],
    PUSH_NOT_CONFIGURED: ["Firebase n’est pas encore configuré pour les notifications.", "Firebase push notifications are not configured yet."],
    PUSH_PERMISSION_DENIED: ["Autorisez les notifications dans votre navigateur pour les activer.", "Allow notifications in your browser to enable them."],
    PUSH_TOKEN_UNAVAILABLE: ["Firebase n’a pas pu créer de jeton pour cet appareil.", "Firebase couldn't create a token for this device."],
    PUSH_REGISTRATION_FAILED: ["Impossible d’enregistrer cet appareil. Réessayez.", "Couldn't register this device. Try again."],
    PUSH_REMOVAL_FAILED: ["Impossible de désactiver les notifications sur cet appareil.", "Couldn't disable notifications on this device."],
    FIREBASE_PUSH_NOT_CONFIGURED: ["Le compte de service Firebase manque dans la configuration du serveur.", "The Firebase service account is missing from the server configuration."],
    FIREBASE_PUSH_INVALID_CONFIGURATION: ["La configuration du compte de service Firebase est invalide.", "The Firebase service account configuration is invalid."],
    FIREBASE_PUSH_INVALID_PRIVATE_KEY: ["La clé privée Firebase du serveur est invalide. Remplacez-la par celle du fichier JSON du compte de service.", "The server's Firebase private key is invalid. Replace it with the key from the service-account JSON file."],
  };
  return copy[code]?.[isFrench ? 0 : 1] ?? (isFrench ? "Une erreur est survenue. Réessayez." : "Something went wrong. Try again.");
}
