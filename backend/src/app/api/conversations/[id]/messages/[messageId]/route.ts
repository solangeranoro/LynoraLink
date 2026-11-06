import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string; messageId: string }> }
) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: params.id, userId } },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = z.object({ scope: z.enum(["me", "everyone"]) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_DELETE_SCOPE" }, { status: 400 });

  const message = await prisma.message.findFirst({
    where: { id: params.messageId, conversationId: params.id },
    select: { id: true, senderId: true },
  });
  if (!message) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (parsed.data.scope === "me") {
    await prisma.messageHiddenForUser.upsert({
      where: { messageId_userId: { messageId: message.id, userId } },
      create: { messageId: message.id, userId },
      update: {},
    });
    return NextResponse.json({ deleted: true, scope: "me" });
  }

  if (message.senderId !== userId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  await prisma.message.delete({ where: { id: message.id } });
  await prisma.conversation.update({ where: { id: params.id }, data: { updatedAt: new Date() } });
  return NextResponse.json({ deleted: true, scope: "everyone" });
}