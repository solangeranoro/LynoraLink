import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashTwoFactorCode } from "@/lib/two-factor-crypto";

const verifySchema = z.object({
  email: z.string().trim().email().max(254),
  code: z.preprocess(
    (value) => typeof value === "string" ? value.replace(/[\s-]/g, "") : value,
    z.string().regex(/^\d{6}$/),
  ),
});

export async function POST(request: Request) {
  const parsed = verifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_code" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true, emailVerified: true },
  });
  if (!user) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  if (user.emailVerified) return NextResponse.json({ verified: true });

  const challenge = await prisma.twoFactorChallenge.findUnique({
    where: { userId_purpose: { userId: user.id, purpose: "REGISTER" } },
  });
  if (!challenge) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  if (challenge.expiresAt <= new Date()) {
    return NextResponse.json({ error: "code_expired" }, { status: 410 });
  }
  if (challenge.attempts >= 5) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const expected = Buffer.from(challenge.codeHash, "hex");
  const received = Buffer.from(hashTwoFactorCode(user.id, "REGISTER", parsed.data.code), "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    await prisma.twoFactorChallenge.updateMany({
      where: { id: challenge.id, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const verified = await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.twoFactorChallenge.deleteMany({
      where: { id: challenge.id, codeHash: challenge.codeHash, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) return false;
    const updated = await transaction.user.updateMany({
      where: { id: user.id, emailVerified: null },
      data: { emailVerified: new Date() },
    });
    return updated.count === 1;
  });

  if (!verified) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  return NextResponse.json({ verified: true });
}