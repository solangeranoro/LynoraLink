import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const ADMIN_EMAIL = "nambinintsoachrysologue0@gmail.com";

export function isPlatformAdmin(email: string | null | undefined) {
  return email?.toLowerCase() === ADMIN_EMAIL;
}

export async function requireAdmin() {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email?.toLowerCase();

  if (!userId || !email) {
    return { response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) } as const;
  }

  if (email !== ADMIN_EMAIL) {
    return { response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) } as const;
  }

  const admin = await prisma.admin.upsert({
    where: { userId },
    update: {},
    create: { userId, role: "SUPERADMIN" },
  });

  return { admin, userId } as const;
}
