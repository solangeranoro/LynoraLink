import NextAuth from "next-auth";
import { NextResponse } from "next/server";

const { auth } = NextAuth({
  providers: [],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        const blocked = token.accountStatus === "BANNED" ||
          (token.accountStatus === "SUSPENDED" &&
            (typeof token.suspendedUntil !== "string" || Date.parse(token.suspendedUntil) > Date.now()));
        session.user.id = blocked ? "" : (typeof token.id === "string" ? token.id : token.sub) ?? "";
        session.user.accountStatus = (token.accountStatus as "ACTIVE" | "SUSPENDED" | "BANNED") ?? "ACTIVE";
        session.user.suspendedUntil = (token.suspendedUntil as string | null) ?? null;
        session.user.accountStatusReason = (token.accountStatusReason as string | null) ?? null;
      }
      return session;
    },
    authorized({ auth: session, request }) {
      const isBlocked = session?.user?.accountStatus === "BANNED" ||
        (session?.user?.accountStatus === "SUSPENDED" &&
          (!session.user.suspendedUntil || Date.parse(session.user.suspendedUntil) > Date.now()));
      if (isBlocked) {
        return NextResponse.redirect(new URL("/account-status", request.url));
      }
      const teamPageMatch = request.nextUrl.pathname.match(/^\/teams\/([^/]+)\/?$/);
      const isPublicTeamPage = Boolean(teamPageMatch && teamPageMatch[1] !== "new");
      return isPublicTeamPage || Boolean(session?.user?.id);
    },
  },
});

export { auth };
