import { prisma } from "@/lib/prisma";

type VerificationEntitlement = {
  status: string
  currentPeriodEnd: Date | null
}

export function hasActiveMarketplaceVerification(
  verification: VerificationEntitlement | null | undefined,
  now = new Date(),
) {
  if (!verification) return false
  if (["active", "on_trial", "trialing"].includes(verification.status)) {
    return !verification.currentPeriodEnd || verification.currentPeriodEnd > now
  }
  return ["canceled", "cancelled"].includes(verification.status) &&
    Boolean(verification.currentPeriodEnd && verification.currentPeriodEnd > now)
}

export async function hasMarketplaceVerification(userId: string) {
  const verification = await prisma.marketplaceVerification.findUnique({
    where: { userId },
    select: { status: true, currentPeriodEnd: true },
  })
  return hasActiveMarketplaceVerification(verification)
}
