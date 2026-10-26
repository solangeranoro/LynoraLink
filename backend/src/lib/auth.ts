import NextAuth, { type NextAuthConfig } from "next-auth";
import { createHmac, timingSafeEqual } from "crypto";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isAccountBlocked } from "@/lib/account-status";
import { isPlatformAdmin } from "@/lib/premium";
import { sendTwoFactorCodeEmail } from "@/lib/email";
import { issueTwoFactorCode } from "@/lib/two-factor";
import { createOAuthTwoFactorToken, hashTwoFactorCode, normalizeTwoFactorCode, verifyOAuthTwoFactorToken } from "@/lib/two-factor-crypto";
import {
  createUniqueUserIdentity,
  isPersonalizedPublicName,
  needsGeneratedPublicName,
} from "@/lib/user-handle";

export { hashTwoFactorCode } from "@/lib/two-factor-crypto";

export const authOptions: NextAuthConfig = {
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login", verifyRequest: "/verify" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        code: { label: "Security code", type: "text" },
      },
      async authorize(credentials) {
        if (typeof credentials?.email !== "string" || typeof credentials.password !== "string") return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });
        if (!user?.passwordHash || !(await bcrypt.compare(credentials.password, user.passwordHash))) {
          return null;
        }
        if (isAccountBlocked(user.accountStatus, user.suspendedUntil)) return null;
        if (!user.emailVerified) return null;
        const code = typeof credentials.code === "string" ? normalizeTwoFactorCode(credentials.code.trim()) : "";
        if (!code || !/^\d{6}$/.test(code)) {
          console.warn("Two-factor sign-in rejected: invalid code format");
          return null;
        }
        const challenge = await prisma.twoFactorChallenge.findUnique({
          where: { userId_purpose: { userId: user.id, purpose: "LOGIN" } },
        });
        if (!challenge) {
          console.warn("Two-factor sign-in rejected: challenge not found");
          return null;
        }
        if (challenge.expiresAt <= new Date()) {
          console.warn("Two-factor sign-in rejected: challenge expired");
          return null;
        }
        if (challenge.attempts >= 5) {
          console.warn("Two-factor sign-in rejected: attempt limit reached");
          return null;
        }

        const expectedHash = hashTwoFactorCode(user.id, "LOGIN", code);
        const expected = Buffer.from(challenge.codeHash, "hex");
        const received = Buffer.from(expectedHash, "hex");
        if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
          await prisma.twoFactorChallenge.updateMany({
            where: { id: challenge.id, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
            data: { attempts: { increment: 1 } },
          });
          console.warn("Two-factor sign-in rejected: code mismatch");
          return null;
        }

        const consumed = await prisma.twoFactorChallenge.deleteMany({
          where: { id: challenge.id, codeHash: challenge.codeHash, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
        });
        if (consumed.count !== 1) {
          console.warn("Two-factor sign-in rejected: challenge already consumed or changed");
          return null;
        }
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
    CredentialsProvider({
      id: "oauth-two-factor",
      name: "oauth-two-factor",
      credentials: {
        token: { label: "Challenge token", type: "text" },
        code: { label: "Security code", type: "text" },
      },
      async authorize(credentials) {
        const token = verifyOAuthTwoFactorToken(typeof credentials?.token === "string" ? credentials.token : undefined);
        const code = typeof credentials?.code === "string" ? normalizeTwoFactorCode(credentials.code.trim()) : "";
        if (!token || !code || !/^\d{6}$/.test(code)) return null;

        const user = await prisma.user.findUnique({
          where: { id: token.userId },
          select: { id: true, name: true, email: true, image: true, accountStatus: true, suspendedUntil: true },
        });
        if (!user || isAccountBlocked(user.accountStatus, user.suspendedUntil)) return null;

        const challenge = await prisma.twoFactorChallenge.findUnique({
          where: { userId_purpose: { userId: user.id, purpose: "LOGIN" } },
        });
        if (
          !challenge ||
          challenge.id !== token.challengeId ||
          challenge.expiresAt <= new Date() ||
          challenge.attempts >= 5
        ) return null;

        const expected = Buffer.from(challenge.codeHash, "hex");
        const received = Buffer.from(hashTwoFactorCode(user.id, "LOGIN", code), "hex");
        if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
          await prisma.twoFactorChallenge.updateMany({
            where: { id: challenge.id, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
            data: { attempts: { increment: 1 } },
          });
          return null;
        }

        const consumed = await prisma.twoFactorChallenge.deleteMany({
          where: { id: challenge.id, codeHash: challenge.codeHash, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
        });
        if (consumed.count !== 1) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      })]
      : []),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [FacebookProvider({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        authorization: {
          url: "https://www.facebook.com/v25.0/dialog/oauth",
          params: { scope: "email" },
        },
        allowDangerousEmailAccountLinking: true,
      })]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      const isOAuthSignIn = account?.type === "oauth" || account?.type === "oidc";
      const normalizedEmail = user.email?.trim().toLowerCase();
      const providerName = user.name?.trim();
      const publicProviderName = providerName && providerName.toLowerCase() !== normalizedEmail
        ? providerName
        : null;
      const userSelect = {
        id: true,
        email: true,
        name: true,
        handle: true,
        preferredLang: true,
        accountStatus: true,
        suspendedUntil: true,
      } as const;
      const dbUserById = user.id
        ? await prisma.user.findUnique({ where: { id: user.id }, select: userSelect })
        : null;
      let dbUser = dbUserById ?? (normalizedEmail
        ? await prisma.user.findUnique({ where: { email: normalizedEmail }, select: userSelect })
        : null);
      if (isOAuthSignIn && !dbUser && normalizedEmail) {
        try {
          const identity = await createUniqueUserIdentity(null);
          dbUser = await prisma.user.upsert({
            where: { email: normalizedEmail },
            update: {},
            create: {
              email: normalizedEmail,
              name: identity.name,
              image: user.image,
              handle: identity.handle,
              emailVerified: new Date(),
            },
            select: userSelect,
          });
        } catch (error) {
          console.error("OAuth account initialization failed", error);
          return "/login?error=OAuthTwoFactorUnavailable";
        }
      }
      if (
        isOAuthSignIn &&
        dbUser &&
        (
          !dbUser.handle ||
          needsGeneratedPublicName(dbUser.name, dbUser.email) ||
          Boolean(publicProviderName && dbUser.name?.trim() === publicProviderName)
        )
      ) {
        try {
          const shouldGenerateDefaultName =
            needsGeneratedPublicName(dbUser.name, dbUser.email) ||
            Boolean(publicProviderName && dbUser.name?.trim() === publicProviderName);
          const existingPublicName = isPersonalizedPublicName(dbUser.name, dbUser.email)
            ? dbUser.name
            : null;
          const identity = await createUniqueUserIdentity(shouldGenerateDefaultName
            ? null
            : publicProviderName ?? existingPublicName);
          await prisma.user.updateMany({
            where: { id: dbUser.id, handle: null },
            data: { handle: identity.handle },
          });
          if (shouldGenerateDefaultName) {
            await prisma.user.updateMany({
              where: { id: dbUser.id, name: dbUser.name },
              data: { name: identity.name },
            });
          }
          dbUser = await prisma.user.findUnique({ where: { id: dbUser.id }, select: userSelect });
        } catch (error) {
          console.error("OAuth public username initialization failed", error);
          return "/login?error=OAuthTwoFactorUnavailable";
        }
      }
      if (isOAuthSignIn && !dbUser) return false;
      if (dbUser && isAccountBlocked(dbUser.accountStatus, dbUser.suspendedUntil)) return false;
      if (isOAuthSignIn && dbUser) {
        let challenge: Awaited<ReturnType<typeof issueTwoFactorCode>> | undefined;
        try {
          challenge = await issueTwoFactorCode(dbUser.id, "LOGIN");
          await sendTwoFactorCodeEmail({
            to: dbUser.email,
            name: dbUser.name ?? "there",
            code: challenge.code,
            purpose: "login",
            locale: dbUser.preferredLang,
          });
          const token = createOAuthTwoFactorToken(dbUser.id, challenge.id);
          return `/login#oauth2fa=${encodeURIComponent(token)}`;
        } catch (error) {
          if (challenge) await prisma.twoFactorChallenge.deleteMany({ where: { id: challenge.id } });
          console.error("OAuth two-factor email failed", error);
          return "/login?error=OAuthTwoFactorUnavailable";
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (typeof user?.id === "string") token.id = user.id;
      const userId = typeof token.sub === "string" ? token.sub : typeof token.id === "string" ? token.id : undefined;
      if (userId) {
        let dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            name: true,
            email: true,
            image: true,
            handle: true,
            preferredLang: true,
            isVerified: true,
            emailVerified: true,
            accountStatus: true,
            suspendedUntil: true,
          },
        });
        if (dbUser) {
          if (!dbUser.handle || needsGeneratedPublicName(dbUser.name, dbUser.email)) {
            const identity = await createUniqueUserIdentity(
              needsGeneratedPublicName(dbUser.name, dbUser.email) ? null : dbUser.name,
            );
            await prisma.user.updateMany({
              where: { id: userId, ...(dbUser.handle ? {} : { handle: null }) },
              data: {
                ...(dbUser.handle ? {} : { handle: identity.handle }),
                ...(needsGeneratedPublicName(dbUser.name, dbUser.email) ? { name: identity.name } : {}),
              },
            });
            dbUser = await prisma.user.findUnique({
              where: { id: userId },
              select: {
                name: true,
                email: true,
                image: true,
                handle: true,
                preferredLang: true,
                isVerified: true,
                emailVerified: true,
                accountStatus: true,
                suspendedUntil: true,
              },
            });
          }
        }
        if (dbUser) {
          token.name = dbUser.name && dbUser.name.toLowerCase() !== dbUser.email.toLowerCase()
            ? dbUser.name
            : dbUser.handle
              ? `Maker ${dbUser.handle}`
              : null;
          token.picture = dbUser.image;
          token.handle = dbUser.handle;
          token.preferredLang = dbUser.preferredLang;
          token.isVerified = (dbUser.isVerified && Boolean(dbUser.emailVerified)) || isPlatformAdmin(token.email);
          token.accountStatus = isAccountBlocked(dbUser.accountStatus, dbUser.suspendedUntil) ? dbUser.accountStatus : "ACTIVE";
          token.suspendedUntil = dbUser.suspendedUntil?.toISOString() ?? null;
        } else {
          token.accountStatus = "BANNED";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const blocked = token.accountStatus === "BANNED" ||
          (token.accountStatus === "SUSPENDED" &&
            (typeof token.suspendedUntil !== "string" || Date.parse(token.suspendedUntil) > Date.now()));
        session.user.id = blocked ? "" : (typeof token.id === "string" ? token.id : token.sub) ?? "";
        session.user.handle = (token.handle as string) ?? null;
        session.user.preferredLang = (token.preferredLang as "EN" | "FR") ?? "EN";
        session.user.isVerified = Boolean(token.isVerified);
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user?.id) {
        await prisma.user
          .update({ where: { id: user.id }, data: { isOnline: true, lastSeenAt: new Date() } })
          .catch(() => undefined);
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const nextAuth = NextAuth(authOptions);
export const auth = nextAuth.auth;
export const { GET, POST } = nextAuth.handlers;