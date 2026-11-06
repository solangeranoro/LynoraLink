import { auth } from "./auth";

export default auth;

// Protège les routes applicatives ; laisse passer l'auth et les assets.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/teams/:path*",
    "/messages/:path*",
    "/copilot/:path*",
    "/huddles/:path*",
    "/discover/:path*",
    "/settings/:path*",
    "/analytics/:path*",
    "/coding",
    "/coding/:path*",
  ],
};
