export { isPlatformAdmin } from "@/lib/admin";

export function hasActivePremiumSubscription() {
  return false;
}

export async function hasActivePremiumSubscriptionForUser() {
  return false;
}

export async function hasVerifiedPremiumAccess(_userId: string) {
  return true;
}

export async function hasPremiumAccess(_userId: string) {
  return true;
}