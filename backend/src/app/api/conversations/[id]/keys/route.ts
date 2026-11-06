import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId } },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }

  const members = await prisma.conversationMember.findMany({
    where: { conversationId: id },
    select: { userId: true },
  });
  const keys = await prisma.userE2EEKey.findMany({
    where: { userId: { in: members.map((member) => member.userId) } },
    select: { userId: true, publicKey: true },
  });
  const publicKeys = new Map(keys.map((key) => [key.userId, key.publicKey]));

  return NextResponse.json({
    members: members.map((member) => ({
      userId: member.userId,
      publicKey: publicKeys.has(member.userId) ? JSON.parse(publicKeys.get(member.userId)!) : null,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
