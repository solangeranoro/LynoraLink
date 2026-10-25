import { prisma } from "@/lib/prisma";
import { isPaddleCopilotEntitled } from "@/lib/paddle";

export const LYNOAI_PLATFORMS = ["lynoralink", "lynoracoding"] as const;
export type LynoAIPlatform = (typeof LYNOAI_PLATFORMS)[number];
export const LYNOAI_ACTIVITY_TYPES = [
  "chat_message",
  "code_generation",
  "inline_completion",
  "code_changes_applied",
  "project_created",
  "post_published",
] as const;
export type LynoAIActivityType = (typeof LYNOAI_ACTIVITY_TYPES)[number];

export function isLynoAIPlatform(value: string | null): value is LynoAIPlatform {
  return value !== null && LYNOAI_PLATFORMS.some((platform) => platform === value);
}

export function nextLynoAIResetAt(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

async function ensureQuota(userId: string, platform: LynoAIPlatform, now = new Date()) {
  const resetAt = nextLynoAIResetAt(now);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { lynaiPremium: true },
  });
  const subscription = await prisma.paddleCopilotSubscription.findUnique({
    where: { userId },
    select: { status: true, currentPeriodEnd: true },
  });
  const subscriptionActive = isPaddleCopilotEntitled(
    subscription?.status ?? "",
    subscription?.currentPeriodEnd ?? null,
    now,
  );
  const premium = user.lynaiPremium || subscriptionActive;
  const quota = await prisma.lynoAIQuota.upsert({
    where: { userId_platform: { userId, platform } },
    create: { userId, platform, resetAt, premium },
    update: { premium },
  });

  if (quota.resetAt <= now) {
    await prisma.lynoAIQuota.updateMany({
      where: { id: quota.id, resetAt: { lte: now } },
      data: { used: 0, resetAt },
    });
  }

  return prisma.lynoAIQuota.findUniqueOrThrow({ where: { id: quota.id } });
}

export async function getLynoAIQuota(userId: string, platform: LynoAIPlatform) {
  return ensureQuota(userId, platform);
}

export async function reserveLynoAIRequest(
  userId: string,
  platform: LynoAIPlatform,
  actionType: Extract<LynoAIActivityType, "chat_message" | "code_generation" | "inline_completion">,
) {
  const quota = await ensureQuota(userId, platform);
  const reservation = await prisma.$transaction(async (transaction) => {
    const reserved = await transaction.lynoAIQuota.updateMany({
      where: {
        id: quota.id,
        OR: [{ premium: true }, { used: { lt: quota.limit } }],
      },
      data: { used: { increment: 1 } },
    });
    if (reserved.count !== 1) return false;

    await transaction.lynoAIUsageEvent.create({
      data: { userId, platform, actionType, countsTowardQuota: true },
      select: { id: true },
    });
    return true;
  });

  if (!reservation) {
    return { allowed: false as const, quota };
  }
  return {
    allowed: true as const,
    quota: await prisma.lynoAIQuota.findUniqueOrThrow({ where: { id: quota.id } }),
  };
}

export async function recordLynoAIActivity(
  userId: string,
  platform: LynoAIPlatform,
  actionType: Extract<LynoAIActivityType, "code_changes_applied" | "project_created" | "post_published">,
) {
  return prisma.lynoAIUsageEvent.create({
    data: { userId, platform, actionType, countsTowardQuota: false },
    select: { id: true },
  });
}
