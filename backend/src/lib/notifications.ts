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
  | "PROJECT_DECLINED";

export async function createNotification(recipientId: string, actorId: string, type: NotificationKind, targetId: string) {
  if (recipientId === actorId) return;
  await prisma.notification.create({ data: { recipientId, actorId, type, targetId } });
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