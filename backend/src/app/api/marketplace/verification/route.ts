import { randomBytes, createHash } from "node:crypto";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";
import { appUrl, sendMarketplaceVerificationEmail } from "@/lib/email";
import { hasActiveMarketplaceVerification } from "@/lib/marketplace-verification";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  country: z.string().trim().min(2).max(100),
  city: z.string().trim().min(1).max(100),
  profession: z.string().trim().min(2).max(120),
  phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable().optional(),
  locale: z.enum(["EN", "FR"]).default("EN"),
}).strict();

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const [verification, account] = await Promise.all([
    prisma.marketplaceVerification.findUnique({
      where: { userId },
      select: {
        fullName: true,
        email: true,
        country: true,
        city: true,
        profession: true,
        phoneNumber: true,
        status: true,
        subscriptionId: true,
        emailVerifiedAt: true,
        emailTokenExpiresAt: true,
        currentPeriodEnd: true,
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } }),
  ]);
  const isVerified = Boolean(
    isPlatformAdmin(account?.email) ||
      (verification?.emailVerifiedAt &&
        account?.emailVerified &&
        verification.email.toLowerCase() === account.email.toLowerCase() &&
        hasActiveMarketplaceVerification(verification)),
  );
  const verificationData = verification
    ? (({ subscriptionId, ...details }) => ({
        ...details,
        hasSubscription: Boolean(subscriptionId),
        emailTokenExpiresAt: details.emailTokenExpiresAt.toISOString(),
        currentPeriodEnd: details.currentPeriodEnd?.toISOString() ?? null,
        isVerified,
      }))(verification)
    : null;
  return NextResponse.json({
    verification: verificationData,
    accountEmail: account?.email ?? null,
    accountEmailVerified: Boolean(account?.emailVerified),
    isVerified,
    isAdminExempt: isPlatformAdmin(account?.email),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_VERIFICATION_REQUEST", issues: parsed.error.flatten().fieldErrors }, { status: 422 });

  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, preferredLang: true },
  });
  if (!account?.email) return NextResponse.json({ error: "ACCOUNT_EMAIL_UNAVAILABLE" }, { status: 400 });
  if (isPlatformAdmin(account.email)) {
    return NextResponse.json({ sent: false, isVerified: true, isAdminExempt: true });
  }
  if (account.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
    return NextResponse.json({ error: "VERIFICATION_EMAIL_MUST_MATCH_ACCOUNT" }, { status: 422 });
  }

  const current = await prisma.marketplaceVerification.findUnique({
    where: { userId },
    select: { email: true, status: true, emailVerifiedAt: true, currentPeriodEnd: true },
  });
  if (current?.emailVerifiedAt && hasActiveMarketplaceVerification(current)) {
    if (current.email.toLowerCase() === account.email.toLowerCase()) {
      return NextResponse.json({ sent: false, alreadyVerified: true });
    }
    return NextResponse.json({ error: "MARKETPLACE_VERIFICATION_ACTIVE" }, { status: 409 });
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const requestData = {
    fullName: parsed.data.fullName,
    email: account.email,
    country: parsed.data.country,
    city: parsed.data.city,
    profession: parsed.data.profession,
    phoneNumber: parsed.data.phoneNumber ?? null,
    plan: "pending_payment",
    status: "pending_email",
    emailToken: tokenHash,
    emailTokenExpiresAt: expiresAt,
    emailVerifiedAt: null,
    subscriptionId: null,
    customerId: null,
    variantId: null,
    currentPeriodEnd: null,
    eventCreatedAt: null,
  };
  await prisma.marketplaceVerification.upsert({
    where: { userId },
    create: { ...requestData, userId },
    update: requestData,
  });

  const locale = parsed.data.locale === "FR" ? "FR" : account.preferredLang;
  try {
    await sendMarketplaceVerificationEmail({
      to: account.email,
      name: parsed.data.fullName || account.name || account.email,
      link: `${appUrl()}/marketplace/verify?token=${encodeURIComponent(token)}`,
      locale,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_email_error";
    console.error("Send marketplace verification email failed:", { reason });
    if (reason === "marketplace_verification_email_transport_not_configured") {
      return NextResponse.json({ error: "EMAIL_DELIVERY_NOT_CONFIGURED" }, { status: 503 });
    }
    return NextResponse.json({ error: "VERIFICATION_EMAIL_SEND_FAILED" }, { status: 502 });
  }
  return NextResponse.json({ sent: true }, { status: 202 });
}
