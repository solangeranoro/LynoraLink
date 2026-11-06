import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FirebasePushConfigurationError, validateFirebasePushConfiguration } from "@/lib/firebase-push";

export const dynamic = "force-dynamic";

const tokenSchema = z.object({ token: z.string().trim().min(20).max(4096) }).strict();

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = tokenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 422 });

  try {
    validateFirebasePushConfiguration();
  } catch (error) {
    if (error instanceof FirebasePushConfigurationError) {
      return NextResponse.json({ error: `FIREBASE_PUSH_${error.code.toUpperCase()}` }, { status: 503 });
    }
    throw error;
  }

  try {
    const existing = await prisma.firebasePushToken.findUnique({
      where: { token: parsed.data.token },
      select: { id: true, userId: true },
    });
    if (existing && existing.userId !== userId) {
      return NextResponse.json({ error: "TOKEN_ALREADY_REGISTERED" }, { status: 409 });
    }
    await prisma.firebasePushToken.upsert({
      where: { token: parsed.data.token },
      create: { token: parsed.data.token, userId },
      update: {},
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Firebase push token registration failed:", error);
    return NextResponse.json({ error: "PUSH_REGISTRATION_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = tokenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 422 });

  try {
    await prisma.firebasePushToken.deleteMany({
      where: { token: parsed.data.token, userId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Firebase push token removal failed:", error);
    return NextResponse.json({ error: "PUSH_REMOVAL_FAILED" }, { status: 500 });
  }
}
