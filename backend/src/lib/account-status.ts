import type { AccountStatus } from "@prisma/client";

export function isAccountBlocked(status: AccountStatus, suspendedUntil: Date | null, now = new Date()) {
  if (status === "BANNED") return true;
  return status === "SUSPENDED" && (!suspendedUntil || suspendedUntil > now);
}