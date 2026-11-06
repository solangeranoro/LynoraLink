import { randomBytes, createHash } from "node:crypto";
import { auth } from "@/lib/auth";
import { appUrl, sendMarketplaceVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RESEND_COOLDOWN_MS = 60_000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const [account, verification] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true, name: true, preferredLang: true },
    }),
    prisma.marketplaceVerification.findUnique({
      where: { userId },
      select: { fullName: true, email: true, status: true, emailVerifiedAt: true, updatedAt: true },
    }),
  ]);

  if (!account?.email || !account.emailVerified) {
    return NextResponse.json({ error: "ACCOUNT_EMAIL_NOT_VERIFIED" }, { status: 409 });
  }
  if (
    !verification ||
    verification.status !== "pending_email" ||
    verification.emailVerifiedAt ||
    verification.email.toLowerCase() !== account.email.toLowerCase()
  ) {
    return NextResponse.json({ error: "VERIFICATION_NOT_PENDING" }, { status: 409 });
  }

  const retryAfter = Math.ceil((verification.updatedAt.getTime() + RESEND_COOLDOWN_MS - Date.now()) / 1000);
  if (retryAfter > 0) {
    return NextResponse.json({ error: "VERIFICATION_RESEND_RATE_LIMITED", retryAfter }, { status: 429 });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const updated = await prisma.marketplaceVerification.updateMany({
    where: {
      userId,
      status: "pending_email",
      emailVerifiedAt: null,
      updatedAt: verification.updatedAt,
    },
    data: {
      emailToken: hashToken(token),
      emailTokenExpiresAt: expiresAt,
    },
  });
  if (updated.count !== 1) {
    return NextResponse.json({ error: "VERIFICATION_NOT_PENDING" }, { status: 409 });
  }

  try {
    await sendMarketplaceVerificationEmail({
      to: account.email,
      name: verification.fullName || account.name || account.email,
      link: `${appUrl()}/marketplace/verify?token=${encodeURIComponent(token)}`,
      locale: account.preferredLang,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_email_error";
    console.error("Resend marketplace verification email failed:", { reason });
    if (reason === "marketplace_verification_email_transport_not_configured") {
      return NextResponse.json({ error: "EMAIL_DELIVERY_NOT_CONFIGURED" }, { status: 503 });
    }
    return NextResponse.json({ error: "VERIFICATION_EMAIL_SEND_FAILED" }, { status: 502 });
  }

  return NextResponse.json({ sent: true, expiresAt: expiresAt.toISOString() }, { status: 202 });
}
