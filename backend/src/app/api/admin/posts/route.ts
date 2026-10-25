import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const statuses = ["PENDING", "APPROVED", "REJECTED"] as const;
const postTypes = ["PERSONAL", "TEAM", "PROJECT"] as const;
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("FEATURE"), postId: z.string().cuid(), featured: z.boolean() }),
  z.object({ action: z.enum(["HIDE", "RESTORE", "RESOLVE_REPORTS", "REMOVE_POLL"]), postId: z.string().cuid() }),
]);
const deleteSchema = z.object({ postId: z.string().min(1).max(100) });

export async function GET(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;

  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(10, Number(params.get("pageSize")) || 20));
  const requestedStatus = params.get("status") ?? "ALL";
  const requestedType = params.get("type") ?? "ALL";
  const search = params.get("q")?.trim();
  if (requestedStatus !== "ALL" && !statuses.includes(requestedStatus as typeof statuses[number])) return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  if (requestedType !== "ALL" && !postTypes.includes(requestedType as typeof postTypes[number])) return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });

  const where: Prisma.PostWhereInput = {
    ...(requestedStatus === "ALL" ? {} : { moderationStatus: requestedStatus as typeof statuses[number] }),
    ...(requestedType === "ALL" ? {} : { type: requestedType as typeof postTypes[number] }),
    ...(search ? { OR: [
      { content: { contains: search, mode: "insensitive" } },
      { author: { is: { handle: { contains: search, mode: "insensitive" } } } },
      { author: { is: { name: { contains: search, mode: "insensitive" } } } },
    ] } : {}),
  };

  const [posts, total, statusCounts, typeCounts] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, type: true, content: true, createdAt: true, moderationStatus: true,
        reviewedBy: true, reviewDate: true, isFeatured: true,
        author: { select: { id: true, name: true, handle: true } },
        project: { select: { id: true, title: true, teamName: true } },
        team: { select: { id: true, title: true, teamName: true } },
        poll: { select: { id: true, type: true, question: true, _count: { select: { votes: true } } } },
        _count: { select: { reports: true, likes: true, comments: true } },
      },
    }),
    prisma.post.count({ where }),
    prisma.post.groupBy({ by: ["moderationStatus"], _count: { _all: true } }),
    prisma.post.groupBy({ by: ["type"], _count: { _all: true } }),
  ]);
  return NextResponse.json({
    posts,
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
    statusCounts: Object.fromEntries(statusCounts.map(({ moderationStatus, _count }) => [moderationStatus, _count._all])),
    typeCounts: Object.fromEntries(typeCounts.map(({ type, _count }) => [type, _count._all])),
  });
}

export async function PATCH(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  const input = parsed.data;

  try {
    const result = await prisma.$transaction(async (transaction) => {
      let post;
      if (input.action === "FEATURE") {
        post = await transaction.post.update({
          where: { id: input.postId },
          data: { isFeatured: input.featured },
          select: { id: true, isFeatured: true, moderationStatus: true },
        });
      } else if (input.action === "HIDE" || input.action === "RESTORE") {
        post = await transaction.post.update({
          where: { id: input.postId },
          data: {
            moderationStatus: input.action === "HIDE" ? "REJECTED" : "APPROVED",
            reviewedBy: access.userId,
            reviewDate: new Date(),
          },
          select: { id: true, isFeatured: true, moderationStatus: true },
        });
      } else {
        post = await transaction.post.findUnique({ where: { id: input.postId }, select: { id: true, isFeatured: true, moderationStatus: true } });
        if (!post) throw new Error("POST_NOT_FOUND");
        if (input.action === "RESOLVE_REPORTS") await transaction.postReport.deleteMany({ where: { postId: post.id } });
        else await transaction.poll.delete({ where: { postId: post.id } });
      }
      await transaction.auditLog.create({
        data: { adminId: access.admin.id, action: `ADMIN_POST_${input.action}`, targetId: input.postId },
      });
      return post;
    });
    return NextResponse.json({ post: result });
  } catch (error) {
    if (error instanceof Error && error.message === "POST_NOT_FOUND") return NextResponse.json({ error: "POST_NOT_FOUND" }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "POST_OR_POLL_NOT_FOUND" }, { status: 404 });
    console.error("Admin post moderation error:", error);
    return NextResponse.json({ error: "POST_ACTION_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.post.delete({ where: { id: parsed.data.postId } });
      await transaction.auditLog.create({
        data: { adminId: access.admin.id, action: "ADMIN_POST_DELETE", targetId: parsed.data.postId },
      });
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "POST_NOT_FOUND" }, { status: 404 });
    console.error("Admin post delete error:", error);
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
}