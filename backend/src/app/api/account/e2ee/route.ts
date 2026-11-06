import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const publicKeySchema = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: z.string().min(1).max(100),
  y: z.string().min(1).max(100),
});

const backupSchema = z.object({
  version: z.literal(1),
  salt: z.string().min(16).max(100),
  iv: z.string().min(12).max(100),
  ciphertext: z.string().min(32).max(20_000),
});

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return noStoreJson({ error: "UNAUTHORIZED" }, { status: 401 });

  const keyRecord = await prisma.userE2EEKey.findUnique({
    where: { userId },
    select: { publicKey: true, encryptedBackup: true },
  });

  return noStoreJson({
    publicKey: keyRecord ? JSON.parse(keyRecord.publicKey) : null,
    backup: keyRecord ? JSON.parse(keyRecord.encryptedBackup) : null,
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return noStoreJson({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = z.object({ publicKey: publicKeySchema, backup: backupSchema }).safeParse(body);
  if (!parsed.success) return noStoreJson({ error: "INVALID_E2EE_KEY" }, { status: 400 });

  try {
    await prisma.userE2EEKey.create({
      data: {
        userId,
        publicKey: JSON.stringify(parsed.data.publicKey),
        encryptedBackup: JSON.stringify(parsed.data.backup),
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return noStoreJson({ error: "E2EE_KEY_ALREADY_REGISTERED" }, { status: 409 });
    }
    console.error("Unable to register an end-to-end encryption key.");
    return noStoreJson({ error: "E2EE_KEY_REGISTRATION_FAILED" }, { status: 500 });
  }

  return noStoreJson({ registered: true });
}
