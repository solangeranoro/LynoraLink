import { prisma } from "@/lib/prisma";
import { isPlatformAdmin } from "@/lib/admin";
import { hasActiveMarketplaceVerification } from "@/lib/marketplace-verification";

export async function hasVerifiedAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailVerified: true,
      marketplaceVerification: { select: { email: true, emailVerifiedAt: true, status: true, currentPeriodEnd: true } },
    },
  });
  if (isPlatformAdmin(user?.email)) return true;
  return Boolean(
    user?.emailVerified &&
    user.email.toLowerCase() === user.marketplaceVerification?.email.toLowerCase() &&
    user.marketplaceVerification?.emailVerifiedAt &&
    hasActiveMarketplaceVerification(user.marketplaceVerification),
  );
}
