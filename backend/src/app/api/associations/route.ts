import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

const personSelect = { id: true, name: true, image: true, handle: true, headline: true, skills: true, openToCoBuild: true } as const;

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const associations = await prisma.association.findMany({
    where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: { requester: { select: personSelect }, addressee: { select: personSelect } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ associations });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = z.object({ addresseeId: z.string().min(1) }).safeParse(body);
  if (!parsed.success || parsed.data.addresseeId === userId) return NextResponse.json({ error: "INVALID_ADDRESSEE" }, { status: 422 });
  const addresseeId = parsed.data.addresseeId;
  const addressee = await prisma.user.findUnique({ where: { id: addresseeId }, select: { id: true } });
  if (!addressee) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  const reverse = await prisma.association.findUnique({ where: { requesterId_addresseeId: { requesterId: addresseeId, addresseeId: userId } } });
  if (reverse?.status === "PENDING") {
    const association = await prisma.association.update({ where: { id: reverse.id }, data: { status: "ACCEPTED" } });
    await createNotification(reverse.requesterId, userId, "ASSOCIATION_ACCEPTED", association.id);
    return NextResponse.json({ association, created: false });
  }
  if (reverse?.status === "ACCEPTED") return NextResponse.json({ association: reverse, created: false });

  const existing = await prisma.association.findUnique({ where: { requesterId_addresseeId: { requesterId: userId, addresseeId } } });
  if (existing?.status === "PENDING" || existing?.status === "ACCEPTED") {
    return NextResponse.json({ association: existing, created: false });
  }
  const association = existing
    ? await prisma.association.update({ where: { id: existing.id }, data: { status: "PENDING" } })
    : await prisma.association.create({ data: { requesterId: userId, addresseeId } });
  await createNotification(addresseeId, userId, "ASSOCIATION_REQUEST", association.id);
  return NextResponse.json({ association, created: true }, { status: existing ? 200 : 201 });
}