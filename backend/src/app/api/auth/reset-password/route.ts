import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const parsed = resetPasswordSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const { token, password } = parsed.data;
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expires < new Date()) {
      return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });
    }
    const now = new Date();
    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expires: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) return false;
      await transaction.user.update({ where: { id: record.userId }, data: { passwordHash } });
      return true;
    });
    if (!updated) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}