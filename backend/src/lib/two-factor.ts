import { Prisma } from "@prisma/client";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashTwoFactorCode } from "@/lib/two-factor-crypto";

export class TwoFactorRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("two_factor_rate_limited");
  }
}

export async function issueTwoFactorCode(userId: string, purpose: "LOGIN" | "ENABLE" | "DISABLE" | "REGISTER" | "DELETE_ACCOUNT") {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${`${userId}:${purpose}`}, 0)) IS NULL AS locked
    `);

    const now = new Date();
    const existing = await transaction.twoFactorChallenge.findUnique({
      where: { userId_purpose: { userId, purpose } },
    });
    const cooldownEndsAt = existing ? existing.createdAt.getTime() + 60_000 : 0;
    if (cooldownEndsAt > now.getTime()) {
      throw new TwoFactorRateLimitError(Math.ceil((cooldownEndsAt - now.getTime()) / 1000));
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const challenge = await transaction.twoFactorChallenge.upsert({
      where: { userId_purpose: { userId, purpose } },
      create: {
        userId,
        purpose,
        codeHash: hashTwoFactorCode(userId, purpose, code),
        expiresAt: new Date(now.getTime() + 10 * 60_000),
        attempts: 0,
      },
      update: {
        codeHash: hashTwoFactorCode(userId, purpose, code),
        expiresAt: new Date(now.getTime() + 10 * 60_000),
        attempts: 0,
        createdAt: now,
      },
      select: { id: true },
    });

    return { id: challenge.id, code };
  });
}