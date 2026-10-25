import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAccountBlocked } from "@/lib/account-status";
import { sendTwoFactorCodeEmail } from "@/lib/email";
import { issueTwoFactorCode, TwoFactorRateLimitError } from "@/lib/two-factor";

const challengeSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const parsed = challengeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });

  const email = parsed.data.email.toLowerCase();

  let user;
  try {
    user = await prisma.user.findUnique({ where: { email } });
  } catch (error) {
    console.error("Two-factor challenge lookup failed", error);
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  if (
    !user?.passwordHash ||
    !user.emailVerified ||
    !(await bcrypt.compare(parsed.data.password, user.passwordHash)) ||
    isAccountBlocked(user.accountStatus, user.suspendedUntil)
  ) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  let challenge: Awaited<ReturnType<typeof issueTwoFactorCode>> | undefined;
  try {
    challenge = await issueTwoFactorCode(user.id, "LOGIN");
    await sendTwoFactorCodeEmail({
      to: user.email,
      name: user.name ?? "there",
      code: challenge.code,
      purpose: "login",
      locale: user.preferredLang,
    });
    return NextResponse.json({ twoFactorRequired: true });
  } catch (error) {
    if (challenge) {
      await prisma.twoFactorChallenge.deleteMany({ where: { id: challenge.id } }).catch(() => undefined);
    }
    if (error instanceof TwoFactorRateLimitError) {
      return NextResponse.json({ error: "rate_limited", retryAfter: error.retryAfterSeconds }, { status: 429 });
    }
    console.error("Two-factor login email failed", error);
    return NextResponse.json({ error: "email_unavailable" }, { status: 503 });
  }
}