import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getConversationMember(conversationId: string, userId: string) {
  return prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  if (!(await getConversationMember(params.id, userId))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const activeSince = new Date(Date.now() - 5000);
  const members = await prisma.conversationMember.findMany({
    where: {
      conversationId: params.id,
      userId: { not: userId },
      typingAt: { gte: activeSince },
    },
    select: { user: { select: { id: true, name: true, image: true } } },
  });

  return NextResponse.json({ typingUsers: members.map(({ user }) => user) });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const membership = await getConversationMember(params.id, userId);
  if (!membership) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = z.object({ isTyping: z.boolean() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_TYPING_STATUS" }, { status: 400 });

  await prisma.conversationMember.update({
    where: { id: membership.id },
    data: { typingAt: parsed.data.isTyping ? new Date() : null },
  });

  return NextResponse.json({ updated: true });
}