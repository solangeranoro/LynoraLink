import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, props: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = z.object({
    enabled: z.boolean().optional(),
    published: z.boolean().optional(),
  }).refine((value) => value.enabled !== undefined || value.published !== undefined).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });

  const { id } = await props.params;
  const updated = await prisma.codingExtension.updateMany({
    where: { id, ownerId: session.user.id },
    data: parsed.data,
  });
  if (updated.count !== 1) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ updated: true });
}

export async function DELETE(_request: Request, props: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await props.params;
  const deleted = await prisma.codingExtension.deleteMany({
    where: { id, ownerId: session.user.id },
  });
  if (deleted.count !== 1) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
