import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const confirmationSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/i) }).strict();

export async function POST(request: Request) {
  const parsed = confirmationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_VERIFICATION_TOKEN" }, { status: 422 });

  const emailToken = createHash("sha256").update(parsed.data.token).digest("hex");
  const existing = await prisma.marketplaceVerification.findUnique({
    where: { emailToken },
    select: { userId: true, email: true, emailVerifiedAt: true },
  });
  if (!existing) return NextResponse.json({ error: "VERIFICATION_TOKEN_INVALID_OR_EXPIRED" }, { status: 400 });
  const now = new Date();
  const confirmed = await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { id: existing.userId },
      select: { email: true, emailVerified: true },
    });
    if (!user || user.email.toLowerCase() !== existing.email.toLowerCase()) return false;

    if (!existing.emailVerifiedAt) {
      const result = await transaction.marketplaceVerification.updateMany({
        where: {
          userId: existing.userId,
          emailToken,
          emailTokenExpiresAt: { gt: now },
          emailVerifiedAt: null,
        },
        data: {
          emailVerifiedAt: now,
          emailTokenExpiresAt: now,
          status: "pending_payment",
          currentPeriodEnd: null,
        },
      });
      if (result.count !== 1) return false;
    }

    if (!user.emailVerified) {
      await transaction.user.update({
        where: { id: existing.userId },
        data: { emailVerified: now },
      });
    }
    return true;
  });
  if (!confirmed) {
    return NextResponse.json({ error: "VERIFICATION_TOKEN_INVALID_OR_EXPIRED" }, { status: 400 });
  }
  return NextResponse.json({ confirmed: true, alreadyConfirmed: Boolean(existing.emailVerifiedAt) });
}
