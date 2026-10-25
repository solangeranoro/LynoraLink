import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
          sender: { select: { id: true, name: true, image: true } },
          hiddenForUsers: { where: { userId }, select: { messageId: true } },
        },
      },
      reactions: { select: { userId: true, reaction: true } },
      attachments: { select: { id: true, name: true, mimeType: true, size: true } },
    },
  });

  const visibleMessages = messages.reverse().map(({ reactions, ...message }) => {
    const reactionCounts: Record<string, number> = {};
    for (const item of reactions) reactionCounts[item.reaction] = (reactionCounts[item.reaction] ?? 0) + 1;
    const replyTo = message.replyTo && message.replyTo.hiddenForUsers.length === 0
      ? { id: message.replyTo.id, content: message.replyTo.content, sender: message.replyTo.sender }
      : null;
    return {
      ...message,
      replyTo,
      reactionCounts,
      reactionByMe: reactions.find((item) => item.userId === userId)?.reaction ?? null,
    };
  });

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
  });
}