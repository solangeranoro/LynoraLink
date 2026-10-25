import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasVerifiedPremiumAccess } from "@/lib/premium";

export const dynamic = "force-dynamic";

type VerifiedUserResult = { allowed: true; userId: string } | { allowed: false; response: NextResponse };

async function getVerifiedUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    return { allowed: false as const, response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }
  if (!await hasVerifiedPremiumAccess(session.user.id)) {
    return { allowed: false as const, response: NextResponse.json({ error: "VERIFICATION_REQUIRED" }, { status: 403 }) };
  }
  return { allowed: true as const, userId: session.user.id };
}

export async function GET() {
  const access = await getVerifiedUserId();
  if (!access.allowed) return access.response;

  try {
    const sessions = await prisma.aiSession.findMany({
      where: { userId: access.userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, input: true, output: true, provider: true, action: true, conversationId: true, createdAt: true },
    });
    return NextResponse.json({ sessions: sessions.reverse() });
  } catch (error) {
    console.error("Copilot history error:", error);
    return NextResponse.json({ error: "AI_HISTORY_UNAVAILABLE" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const access = await getVerifiedUserId();
  if (!access.allowed) return access.response;

  const conversationId = new URL(request.url).searchParams.get("conversationId")?.trim();
  if (!conversationId || conversationId.length > 100) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
  }

  try {
    const result = await prisma.aiSession.deleteMany({
      where: {
        userId: access.userId,
        OR: [
          { conversationId },
          { id: conversationId, conversationId: null },
        ],
      },
    });
    if (result.count === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("Copilot conversation deletion error:", error);
    return NextResponse.json({ error: "AI_HISTORY_UNAVAILABLE" }, { status: 503 });
  }
}