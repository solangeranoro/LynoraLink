import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const updateUserSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("BAN"), userId: z.string().cuid() }),
  z.object({ action: z.literal("SUSPEND"), userId: z.string().cuid(), days: z.number().int().min(1).max(30) }),
  z.object({ action: z.literal("RELEASE"), userId: z.string().cuid() }),
]);

export async function GET(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;

  const now = new Date();
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(Number(params.get("pageSize")) || 20)));
  const search = params.get("q")?.trim();
  const where: Prisma.UserWhereInput = {
    adminProfile: null,
    ...(search ? { OR: [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { handle: { contains: search, mode: "insensitive" } },
    ] } : {}),
  };
  await prisma.user.updateMany({
    where: { accountStatus: "SUSPENDED", suspendedUntil: { lte: now } },
    data: { accountStatus: "ACTIVE", suspendedUntil: null },
  });

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        handle: true,
        city: true,
        location: true,
        isOnline: true,
        accountStatus: true,
        suspendedUntil: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
}

export async function PATCH(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;

  const parsed = updateUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
  const input = parsed.data;

  try {
    const target = await prisma.user.findUnique({ where: { id: input.userId }, select: { adminProfile: { select: { id: true } } } });
    if (!target) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (target.adminProfile || input.userId === access.userId) return NextResponse.json({ error: "ADMIN_ACCOUNT_PROTECTED" }, { status: 403 });

    const updateData: Prisma.UserUpdateInput = input.action === "BAN"
      ? { accountStatus: "BANNED", suspendedUntil: null }
      : input.action === "SUSPEND"
        ? { accountStatus: "SUSPENDED", suspendedUntil: new Date(Date.now() + input.days * 24 * 60 * 60 * 1000) }
        : { accountStatus: "ACTIVE", suspendedUntil: null };
    const auditAction = `ADMIN_USER_${input.action}`;

    const user = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id: input.userId },
        data: updateData,
        select: { id: true, accountStatus: true, suspendedUntil: true },
      });
      await transaction.auditLog.create({
        data: {
          adminId: access.admin.id,
          action: auditAction,
          targetId: input.userId,
        },
      });
      return updated;
    });

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }
    console.error("Admin user update error:", error);
    return NextResponse.json({ error: "USER_UPDATE_FAILED" }, { status: 500 });
  }
}