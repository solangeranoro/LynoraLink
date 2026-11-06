import { prisma } from "@/lib/prisma";

export type NotificationKind =
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

export async function createNotification(recipientId: string, actorId: string, type: NotificationKind, targetId: string) {
  if (recipientId === actorId) return;
  await prisma.notification.create({ data: { recipientId, actorId, type, targetId } });
  const { sendFirebasePushNotification } = await import("@/lib/firebase-push");
  await sendFirebasePushNotification(recipientId, type, actorId, notificationLink(type, targetId)).catch((error: unknown) => {
    console.error("Firebase push notifications are unavailable:", error);
  });
}

function notificationLink(type: NotificationKind, targetId: string) {
  const encodedTargetId = encodeURIComponent(targetId);
  if (type === "WELCOME") return "/dashboard";
  if (type === "POST_REACTION" || type === "POST_COMMENT") return `/dashboard#post-${encodedTargetId}`;
  if (type === "ASSOCIATION_REQUEST") return "/profile#association-requests";
  if (type === "ASSOCIATION_ACCEPTED") return "/messages";
  if (type === "PROJECT_REQUEST" || type === "TEAM_MODERATION_ALERT") return `/teams/${encodedTargetId}/manage`;
  if (type === "TESTER_APPLICATION_SUBMITTED") return "/admin/tester-applications";
  if (type === "TESTER_APPLICATION_BUG_REPORTED") return `/tester-applications/${encodedTargetId}#tester-bugs`;
  if (type === "TESTER_APPLICATION_APPROVED" || type === "TESTER_APPLICATION_REJECTED") {
    return `/tester-applications/${encodedTargetId}/manage`;
  }
  return `/projects/${encodedTargetId}`;
}

export async function createWelcomeNotification(userId: string) {
  await prisma.notification.create({
    data: {
      recipientId: userId,
      actorId: null,
      type: "WELCOME",
      targetId: userId,
    },
  });
}