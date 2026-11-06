import { createPrivateKey } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "@/lib/prisma";

export class FirebasePushConfigurationError extends Error {
  constructor(readonly code: "not_configured" | "invalid_configuration" | "invalid_private_key") {
    super(code);
  }
}

type PushNotificationKind =
  | "MESSAGE"
  | "WELCOME"
  | "POST_REACTION"
  | "POST_COMMENT"
  | "ASSOCIATION_REQUEST"
  | "ASSOCIATION_ACCEPTED"
  | "PROJECT_REQUEST"
  | "PROJECT_INVITE"
  | "PROJECT_ACCEPTED"
  | "PROJECT_DECLINED"
  | "TEAM_MODERATION_ALERT"
  | "TESTER_APPLICATION_SUBMITTED"
  | "TESTER_APPLICATION_BUG_REPORTED"
  | "TESTER_APPLICATION_APPROVED"
  | "TESTER_APPLICATION_REJECTED";

function getFirebaseServiceAccount() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new FirebasePushConfigurationError("not_configured");

  let serviceAccount: { project_id?: string; client_email?: string; private_key?: string };
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as typeof serviceAccount;
  } catch {
    throw new FirebasePushConfigurationError("invalid_configuration");
  }
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new FirebasePushConfigurationError("invalid_configuration");
  }

  const privateKey = serviceAccount.private_key
    .replaceAll("\\r\\n", "\n")
    .replaceAll("\\n", "\n")
    .replace(/\r\n/g, "\n");
  try {
    createPrivateKey(privateKey);
  } catch {
    throw new FirebasePushConfigurationError("invalid_private_key");
  }

  return { ...serviceAccount, private_key: privateKey };
}

export function validateFirebasePushConfiguration() {
  getFirebaseServiceAccount();
}

function getFirebaseMessaging() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return null;

  const serviceAccount = getFirebaseServiceAccount();
  const existingApp = getApps().find((app) => app.name === "lynoralink-push");
  if (existingApp) return getMessaging(existingApp);

  const app = initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  }, "lynoralink-push");
  return getMessaging(app);
}

function shouldNotifyOnPush(type: PushNotificationKind, preferences: {
  notifyProjectUpdates: boolean;
  notifyProductNews: boolean;
}) {
  if (type === "WELCOME") return preferences.notifyProductNews;
  if (type === "MESSAGE") return true;
  return preferences.notifyProjectUpdates;
}

function pushCopy(type: PushNotificationKind, locale: "EN" | "FR", actorName: string) {
  const copy: Record<PushNotificationKind, { EN: string; FR: string }> = {
    MESSAGE: { EN: `${actorName} sent you a message`, FR: `${actorName} vous a envoyé un message` },
    WELCOME: { EN: "Welcome to LynoraLink", FR: "Bienvenue sur LynoraLink" },
    POST_REACTION: { EN: `${actorName} reacted to your post`, FR: `${actorName} a réagi à votre publication` },
    POST_COMMENT: { EN: `${actorName} commented on your post`, FR: `${actorName} a commenté votre publication` },
    ASSOCIATION_REQUEST: { EN: `${actorName} wants to connect`, FR: `${actorName} souhaite entrer en contact` },
    ASSOCIATION_ACCEPTED: { EN: `${actorName} accepted your connection`, FR: `${actorName} a accepté votre demande de contact` },
    PROJECT_REQUEST: { EN: `${actorName} requested to join your project`, FR: `${actorName} souhaite rejoindre votre projet` },
    PROJECT_INVITE: { EN: `${actorName} invited you to collaborate`, FR: `${actorName} vous invite à collaborer` },
    PROJECT_ACCEPTED: { EN: `${actorName} joined your project`, FR: `${actorName} a rejoint votre projet` },
    PROJECT_DECLINED: { EN: `${actorName} declined the project invitation`, FR: `${actorName} a décliné l’invitation au projet` },
    TEAM_MODERATION_ALERT: { EN: "A team post needs moderation review", FR: "Une publication d’équipe doit être modérée" },
    TESTER_APPLICATION_SUBMITTED: { EN: "A beta testing application needs review", FR: "Une application à tester attend votre validation" },
    TESTER_APPLICATION_BUG_REPORTED: { EN: `${actorName} reported an issue with your app`, FR: `${actorName} a signalé un problème sur votre application` },
    TESTER_APPLICATION_APPROVED: { EN: "Your beta testing application was approved", FR: "Votre application de test a été approuvée" },
    TESTER_APPLICATION_REJECTED: { EN: "Your beta testing application was declined", FR: "Votre application de test a été refusée" },
  };
  return copy[type][locale];
}

export async function sendFirebasePushNotification(
  recipientId: string,
  type: PushNotificationKind,
  actorId: string,
  link?: string,
) {
  const messaging = getFirebaseMessaging();
  if (!messaging) return;

  const [recipient, actor] = await Promise.all([
    prisma.user.findUnique({
      where: { id: recipientId },
      select: {
        preferredLang: true,
        notifyProjectUpdates: true,
        notifyProductNews: true,
        firebasePushTokens: { select: { id: true, token: true } },
      },
    }),
    prisma.user.findUnique({ where: { id: actorId }, select: { name: true, handle: true } }),
  ]);
  if (!recipient || !recipient.firebasePushTokens.length || !shouldNotifyOnPush(type, recipient)) return;

  const actorName = actor?.name?.trim() || (actor?.handle ? `@${actor.handle}` : "LynoraLink");
  const body = pushCopy(type, recipient.preferredLang, actorName);
  const invalidTokenIds: string[] = [];

  await Promise.all(recipient.firebasePushTokens.map(async ({ id, token }) => {
    try {
      await messaging.send({
        token,
        data: {
          title: "LynoraLink",
          body,
          link: link ?? "/dashboard",
        },
        webpush: { headers: { Urgency: "normal" } },
      });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        invalidTokenIds.push(id);
      }
      console.error("Firebase push delivery failed:", code);
    }
  }));

  if (invalidTokenIds.length) {
    await prisma.firebasePushToken.deleteMany({ where: { id: { in: invalidTokenIds } } });
  }
}
