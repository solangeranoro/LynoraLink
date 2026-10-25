import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      handle?: string | null;
      preferredLang?: "EN" | "FR";
      isVerified?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    handle?: string | null;
    preferredLang?: "EN" | "FR";
    isVerified?: boolean;
    accountStatus?: "ACTIVE" | "SUSPENDED" | "BANNED";
    suspendedUntil?: string | null;
  }
}