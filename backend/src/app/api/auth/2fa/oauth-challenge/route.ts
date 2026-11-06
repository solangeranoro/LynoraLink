import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendTwoFactorCodeEmail } from "@/lib/email";
import { issueTwoFactorCode, TwoFactorRateLimitError } from "@/lib/two-factor";
import { verifyOAuthTwoFactorToken } from "@/lib/two-factor-crypto";

const schema = z.object({ token: z.string().min(1).max(2048) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const token = verifyOAuthTwoFactorToken(parsed.data.token);
  if (!token) return NextResponse.json({ error: "invalid_challenge" }, { status: 401 });

  const [user, challenge] = await Promise.all([
    prisma.user.findUnique({
      where: { id: token.userId },
      select: { id: true, email: true, name: true, preferredLang: true },
    }),
    prisma.twoFactorChallenge.findUnique({
      where: { userId_purpose: { userId: token.userId, purpose: "LOGIN" } },
    }),
  ]);
  if (
    !user ||
    !challenge ||
    challenge.id !== token.challengeId ||
    challenge.expiresAt <= new Date() ||
    challenge.attempts >= 5
  ) {
    return NextResponse.json({ error: "invalid_challenge" }, { status: 401 });
  }

  let issued: Awaited<ReturnType<typeof issueTwoFactorCode>> | undefined;
  try {
    issued = await issueTwoFactorCode(user.id, "LOGIN");
    if (issued.id !== token.challengeId) {
      await prisma.twoFactorChallenge.deleteMany({ where: { id: issued.id } });
      return NextResponse.json({ error: "invalid_challenge" }, { status: 401 });
    }
    await sendTwoFactorCodeEmail({
      to: user.email,
      name: user.name ?? "there",
      code: issued.code,
      purpose: "login",
      locale: user.preferredLang,
    });
    return NextResponse.json({ sent: true });
  } catch (error) {
    if (issued) await prisma.twoFactorChallenge.deleteMany({ where: { id: issued.id } });
    if (error instanceof TwoFactorRateLimitError) {
      return NextResponse.json({ error: "rate_limited", retryAfter: error.retryAfterSeconds }, { status: 429 });
    }
    console.error("OAuth two-factor resend failed", error);
    return NextResponse.json({ error: "email_unavailable" }, { status: 503 });
  }
}
