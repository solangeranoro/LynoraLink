import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  decryptMessageAttachmentMetadata,
  decryptMessageContent,
  MessageEncryptionError,
} from "@/lib/message-encryption";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: params.id, userId } },
  });
  if (!membership) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, image: true, handle: true, headline: true, isOnline: true },
          },
        },
      },
    },
  });
  if (!conversation) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: { conversationId: params.id, hiddenForUsers: { none: { userId } } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      sender: { select: { id: true, name: true, image: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          encryptionVersion: true,
          keyEnvelopes: true,
          sender: { select: { id: true, name: true, image: true } },
          hiddenForUsers: { where: { userId }, select: { messageId: true } },
        },
      },
      reactions: { select: { userId: true, reaction: true } },
      attachments: { select: { id: true, name: true, mimeType: true, size: true, position: true }, orderBy: { position: "asc" } },
    },
  });

  let visibleMessages;
  try {
    visibleMessages = messages.reverse().map(({ reactions, ...message }) => {
      const reactionCounts: Record<string, number> = {};
      for (const item of reactions) reactionCounts[item.reaction] = (reactionCounts[item.reaction] ?? 0) + 1;
      const replyTo = message.replyTo && message.replyTo.hiddenForUsers.length === 0
        ? {
          id: message.replyTo.id,
          content: message.replyTo.encryptionVersion === 2
            ? decryptMessageContent(message.replyTo.content, `message-body:${params.id}:${message.replyTo.id}`)
            : message.replyTo.content,
          encryptionVersion: message.replyTo.encryptionVersion,
          keyEnvelopes: message.replyTo.keyEnvelopes,
          sender: message.replyTo.sender,
        }
        : null;
      return {
        ...message,
        content: message.encryptionVersion === 2
          ? decryptMessageContent(message.content, `message-body:${params.id}:${message.id}`)
          : message.content,
        attachments: message.encryptionVersion === 2
          ? message.attachments.map((attachment) => ({
            ...attachment,
            ...decryptMessageAttachmentMetadata(attachment.name, attachment.id),
          }))
          : message.attachments,
        replyTo,
        reactionCounts,
        reactionByMe: reactions.find((item) => item.userId === userId)?.reaction ?? null,
      };
    });
  } catch (error) {
    if (error instanceof MessageEncryptionError) {
      if (error.code === "missing_key") {
        return NextResponse.json({ error: "MESSAGE_ENCRYPTION_KEY_MISSING" }, { status: 503 });
      }
      if (error.code === "invalid_key") {
        return NextResponse.json({ error: "MESSAGE_ENCRYPTION_KEY_INVALID" }, { status: 503 });
      }
      return NextResponse.json({ error: "MESSAGE_DECRYPTION_FAILED" }, { status: 500 });
    }
    throw error;
  }

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: params.id, userId } },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      isGroup: conversation.isGroup,
      participants: conversation.members.filter((member) => member.userId !== userId).map((member) => member.user),
      messages: visibleMessages,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}