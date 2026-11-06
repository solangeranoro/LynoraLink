import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validators";
import { appUrl, sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
  }

  const parsed = forgotPasswordSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });

  const email = parsed.data.email.toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ ok: true });

    const activeToken = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id, usedAt: null, expires: { gt: new Date() } },
      select: { id: true },
    });
    if (activeToken) return NextResponse.json({ ok: true });

    const token = randomBytes(32).toString("hex");
    const resetToken = await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expires: new Date(Date.now() + 1000 * 60 * 60) },
      select: { id: true },
    });
    const link = `${appUrl()}/reset-password?token=${token}`;

    try {
      await sendPasswordResetEmail({
        to: email,
        name: user.name ?? "there",
        link,
        locale: user.preferredLang,
      });
    } catch (error) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } }).catch(() => undefined);
      console.error("Forgot password email error:", error);
      return NextResponse.json({ error: "EMAIL_UNAVAILABLE" }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Forgot password database error:", error);
    return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  }
}