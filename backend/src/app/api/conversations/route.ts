import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  decryptMessageAttachmentMetadata,
  decryptMessageContent,
  MessageEncryptionError,
} from "@/lib/message-encryption";

export const dynamic = "force-dynamic";

const conversationInclude = (userId: string) => ({
  members: {
    include: {
      user: {
        select: { id: true, name: true, image: true, handle: true, headline: true, isOnline: true },
      },
    },
  },
  messages: {
    where: { hiddenForUsers: { none: { userId } } },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: {
      sender: { select: { id: true, name: true } },
      attachments: {
        select: { id: true, name: true, mimeType: true, size: true, position: true },
        orderBy: { position: "asc" as const },
      },
    },
  },
});

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const conversations = await prisma.conversation.findMany({
    where: { members: { some: { userId } } },
    include: conversationInclude(userId),
    orderBy: { updatedAt: "desc" },
  });

  try {
    return NextResponse.json({
      conversations: conversations.map((conversation) => {
        const ownMembership = conversation.members.find((member) => member.userId === userId);
        const lastMessage = conversation.messages[0];
        return {
          id: conversation.id,
          title: conversation.title,
          isGroup: conversation.isGroup,
          updatedAt: conversation.updatedAt,
          participants: conversation.members.filter((member) => member.userId !== userId).map((member) => member.user),
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            content: lastMessage.encryptionVersion === 2
              ? decryptMessageContent(lastMessage.content, `message-body:${conversation.id}:${lastMessage.id}`)
              : lastMessage.encryptionVersion ? "" : lastMessage.content,
            encryptionVersion: lastMessage.encryptionVersion,
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt,
            sender: lastMessage.sender,
            ...(lastMessage.encryptionVersion === 2
              ? {
                attachments: lastMessage.attachments.map((attachment) => ({
                  id: attachment.id,
                  position: attachment.position,
                  ...decryptMessageAttachmentMetadata(attachment.name, attachment.id),
                })),
              }
              : {}),
          } : null,
          lastReadAt: ownMembership?.lastReadAt ?? null,
        };
      }),
    }, { headers: { "Cache-Control": "private, no-store" } });
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
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = z.object({ recipientId: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_RECIPIENT" }, { status: 400 });
  const recipientId = parsed.data.recipientId;
  if (recipientId === userId) return NextResponse.json({ error: "SELF_CONVERSATION" }, { status: 400 });

  const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { id: true } });
  if (!recipient) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  const possibleConversations = await prisma.conversation.findMany({
    where: { isGroup: false, members: { some: { userId } } },
    include: { members: { select: { userId: true } } },
  });
  const existing = possibleConversations.find((conversation) =>
    conversation.members.length === 2 && conversation.members.some((member) => member.userId === recipientId),
  );
  if (existing) return NextResponse.json({ id: existing.id, created: false }, { headers: { "Cache-Control": "private, no-store" } });

  const conversation = await prisma.conversation.create({
    data: {
      isGroup: false,
      members: { create: [{ userId }, { userId: recipientId }] },
    },
    select: { id: true },
  });
  return NextResponse.json({ id: conversation.id, created: true }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}