import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendTwoFactorCodeEmail } from "@/lib/email";
import { issueTwoFactorCode, TwoFactorRateLimitError } from "@/lib/two-factor";

const resendSchema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  const parsed = resendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true, name: true, email: true, emailVerified: true, preferredLang: true },
  });
  if (!user || user.emailVerified) return NextResponse.json({ ok: true });

  let challenge: Awaited<ReturnType<typeof issueTwoFactorCode>> | undefined;
  try {
    challenge = await issueTwoFactorCode(user.id, "REGISTER");
    await sendTwoFactorCodeEmail({
      to: user.email,
      name: user.name ?? "there",
      code: challenge.code,
      purpose: "registration",
      locale: user.preferredLang,
    });
    return NextResponse.json({ sent: true });
  } catch (error) {
    if (challenge) await prisma.twoFactorChallenge.deleteMany({ where: { id: challenge.id } });
    if (error instanceof TwoFactorRateLimitError) {
      return NextResponse.json({ error: "rate_limited", retryAfter: error.retryAfterSeconds }, { status: 429 });
    }
    console.error("Registration verification email failed");
    return NextResponse.json({ error: "email_unavailable" }, { status: 503 });
  }
}