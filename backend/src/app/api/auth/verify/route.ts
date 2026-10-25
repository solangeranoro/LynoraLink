import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/email";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.redirect(`${appUrl()}/verify?status=invalid`);
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date() || !record.userId) {
    return NextResponse.redirect(`${appUrl()}/verify?status=expired`);
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({ where: { token: record.token } }),
  ]);
  return NextResponse.redirect(`${appUrl()}/login?verified=1`);
}