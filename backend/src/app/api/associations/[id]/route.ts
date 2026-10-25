import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = z.object({ status: z.enum(["ACCEPTED", "REJECTED"]) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_STATUS" }, { status: 422 });
  const result = await prisma.association.updateMany({
    where: { id: params.id, addresseeId: userId, status: "PENDING" },
    data: { status: parsed.data.status },
  });
  if (!result.count) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const association = await prisma.association.findUnique({
    where: { id: params.id },
    include: { requester: { select: { id: true, name: true, image: true, handle: true } } },
  });
  if (association?.status === "ACCEPTED") await createNotification(association.requesterId, userId, "ASSOCIATION_ACCEPTED", association.id);
  return NextResponse.json({ association });
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const result = await prisma.association.deleteMany({
    where: {
      id: params.id,
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });
  if (!result.count) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ success: true });
}