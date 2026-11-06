import { createHmac, timingSafeEqual } from "crypto";

type OAuthTwoFactorToken = {
  userId: string;
  challengeId: string;
  expiresAt: number;
};

function twoFactorSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for two-factor authentication");
  return secret;
}

export function hashTwoFactorCode(
  userId: string,
  purpose: "LOGIN" | "ENABLE" | "DISABLE" | "REGISTER" | "DELETE_ACCOUNT",
  code: string,
) {
  return createHmac("sha256", twoFactorSecret()).update(`${userId}:${purpose}:${code}`).digest("hex");
}

export function normalizeTwoFactorCode(value: string) {
  return value.replace(/[\s-]/g, "");
}

export function createOAuthTwoFactorToken(userId: string, challengeId: string) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    challengeId,
    expiresAt: Date.now() + 10 * 60_000,
  })).toString("base64url");
  const signature = createHmac("sha256", twoFactorSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOAuthTwoFactorToken(value: unknown): OAuthTwoFactorToken | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = createHmac("sha256", twoFactorSecret()).update(payload).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const token = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<OAuthTwoFactorToken>;
    if (
      typeof token.userId !== "string" ||
      typeof token.challengeId !== "string" ||
      typeof token.expiresAt !== "number" ||
      token.expiresAt <= Date.now()
    ) return null;
    return {
      userId: token.userId,
      challengeId: token.challengeId,
      expiresAt: token.expiresAt,
    };
  } catch {
    return null;
  }
}
