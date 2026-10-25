import NextAuth from "next-auth";

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
      }
      return session;
    },
    authorized({ auth: session }) {
      return Boolean(session?.user?.id);
    },
  },
});

export { auth };
