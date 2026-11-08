import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const ADMIN_EMAIL = "chrysologuenambinintsoa@gmail.com";

export function isPlatformAdmin(email: string | null | undefined) {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}

export async function requireAdmin() {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId || !email) {
    return { response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) } as const;
  }

  if (!isPlatformAdmin(email)) {
    return { response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) } as const;
  }

  const admin = await prisma.admin.upsert({
    where: { userId },
    update: {},
    create: { userId, role: "SUPERADMIN" },
  });

  return { admin, userId } as const;
}
