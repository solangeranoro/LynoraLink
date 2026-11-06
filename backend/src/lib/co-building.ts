import { createHmac } from "node:crypto";

export type CoBuildingTicket = {
  projectId: string;
  userId: string;
  clientId: string;
  userName: string;
  userImage?: string | null;
  expiresAt: number;
}

export function createCoBuildingTicket(payload: Omit<CoBuildingTicket, "expiresAt">): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for co-building.");

  const encodedPayload = Buffer.from(JSON.stringify({
    ...payload,
    expiresAt: Date.now() + 4 * 60 * 60 * 1_000,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}
