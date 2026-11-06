import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const reactionSchema = z.object({
  reaction: z.enum(["like", "love", "celebrate", "support", "laugh", "insightful"]),
});

export async function POST(
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

  const message = await prisma.message.findFirst({
    where: { id: params.messageId, conversationId: params.id },
    select: { id: true },
  });
  if (!message) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REACTION" }, { status: 400 });

  const result = await prisma.$transaction(async (transaction) => {
    const key = { messageId_userId: { messageId: message.id, userId } };
    const current = await transaction.messageReaction.findUnique({ where: key });
    if (current?.reaction === parsed.data.reaction) {
      await transaction.messageReaction.delete({ where: { id: current.id } });
    } else if (current) {
      await transaction.messageReaction.update({ where: { id: current.id }, data: { reaction: parsed.data.reaction } });
    } else {
      await transaction.messageReaction.create({ data: { messageId: message.id, userId, reaction: parsed.data.reaction } });
    }

    const reactions = await transaction.messageReaction.findMany({ where: { messageId: message.id }, select: { userId: true, reaction: true } });
    const reactionCounts: Record<string, number> = {};
    for (const item of reactions) reactionCounts[item.reaction] = (reactionCounts[item.reaction] ?? 0) + 1;
    return { reaction: reactions.find((item) => item.userId === userId)?.reaction ?? null, reactionCounts };
  });

  return NextResponse.json(result);
}