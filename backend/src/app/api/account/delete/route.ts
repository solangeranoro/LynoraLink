import { timingSafeEqual } from "node:crypto";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashTwoFactorCode } from "@/lib/auth";
import { sendTwoFactorCodeEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { issueTwoFactorCode, TwoFactorRateLimitError } from "@/lib/two-factor";

const deleteAccountSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("send") }),
  z.object({ step: z.literal("verify"), code: z.string().regex(/^\d{6}$/) }),
]);

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = deleteAccountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, preferredLang: true },
  });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (parsed.data.step === "send") {
    let challenge: Awaited<ReturnType<typeof issueTwoFactorCode>> | undefined;
    try {
      challenge = await issueTwoFactorCode(user.id, "DELETE_ACCOUNT");
      await sendTwoFactorCodeEmail({
        to: user.email,
        name: user.name ?? "there",
        code: challenge.code,
        purpose: "deletion",
        locale: user.preferredLang,
      });
      return NextResponse.json({ sent: true });
    } catch (error) {
      if (challenge) await prisma.twoFactorChallenge.deleteMany({ where: { id: challenge.id } });
      if (error instanceof TwoFactorRateLimitError) {
        return NextResponse.json({ error: "rate_limited", retryAfter: error.retryAfterSeconds }, { status: 429 });
      }
      return NextResponse.json({ error: "email_unavailable" }, { status: 503 });
    }
  }

  const challenge = await prisma.twoFactorChallenge.findUnique({
    where: { userId_purpose: { userId: user.id, purpose: "DELETE_ACCOUNT" } },
  });
  if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= 5) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const expected = Buffer.from(challenge.codeHash, "hex");
  const received = Buffer.from(hashTwoFactorCode(user.id, "DELETE_ACCOUNT", parsed.data.code), "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    await prisma.twoFactorChallenge.updateMany({
      where: { id: challenge.id, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const deleted = await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.twoFactorChallenge.deleteMany({
      where: { id: challenge.id, codeHash: challenge.codeHash, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) return false;

    await transaction.marketplaceOrder.deleteMany({ where: { item: { sellerId: user.id } } });
    const conversations = await transaction.conversationMember.findMany({
      where: { userId: user.id },
      select: { conversationId: true },
    });
    const conversationIds = conversations.map(({ conversationId }) => conversationId);
    await transaction.conversationMember.deleteMany({ where: { userId: user.id } });
    if (conversationIds.length) {
      await transaction.conversation.deleteMany({
        where: { id: { in: conversationIds }, members: { none: {} } },
      });
    }
    await transaction.user.delete({ where: { id: user.id } });
    return true;
  });

  if (!deleted) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  return NextResponse.json({ deleted: true });
}