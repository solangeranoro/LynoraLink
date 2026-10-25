import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasVerifiedAccount } from "@/lib/verified-account";

type RouteContext = { params: Promise<{ id: string }> };

const contactSchema = z.object({ content: z.string().trim().min(10).max(4000) }).strict();

export async function POST(request: Request, props: RouteContext) {
  const params = await props.params;
  const session = await auth();
  const senderId = session?.user?.id;
  if (!senderId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_MESSAGE", issues: parsed.error.flatten().fieldErrors }, { status: 422 });

  const item = await prisma.marketplaceItem.findFirst({
    where: { id: params.id, isActive: true },
    select: { id: true, title: true, sellerId: true },
  });
  if (!item) return NextResponse.json({ error: "LISTING_NOT_AVAILABLE" }, { status: 404 });
  if (!(await hasVerifiedAccount(item.sellerId))) {
    return NextResponse.json({ error: "LISTING_NOT_AVAILABLE" }, { status: 404 });
  }
  if (item.sellerId === senderId) return NextResponse.json({ error: "OWN_LISTING" }, { status: 409 });

  const result = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.conversation.findFirst({
      where: {
        isGroup: false,
        members: { some: { userId: senderId } },
        AND: [
          { members: { some: { userId: item.sellerId } } },
          { members: { every: { userId: { in: [senderId, item.sellerId] } } } },
        ],
      },
      select: { id: true },
    });
    const conversation = existing ?? (await transaction.conversation.create({
      data: { isGroup: false, members: { create: [{ userId: senderId }, { userId: item.sellerId }] } },
      select: { id: true },
    }));
    const contextualMessage = `Marketplace · ${item.title}\n\n${parsed.data.content}`;
    await transaction.message.create({
      data: { conversationId: conversation.id, senderId, content: contextualMessage },
    });
    await transaction.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    await transaction.conversationMember.update({
      where: { conversationId_userId: { conversationId: conversation.id, userId: senderId } },
      data: { lastReadAt: new Date() },
    });
    return { conversationId: conversation.id, created: !existing };
  });

  return NextResponse.json(result, { status: result.created ? 201 : 200 });
}