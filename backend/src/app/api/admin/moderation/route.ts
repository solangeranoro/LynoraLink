import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const reviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("DISMISS"), caseId: z.string().cuid() }),
  z.object({ action: z.literal("CONFIRM"), caseId: z.string().cuid() }),
  z.object({ action: z.literal("SUSPEND"), caseId: z.string().cuid(), days: z.number().int().min(1).max(30) }),
  z.object({ action: z.literal("BAN"), caseId: z.string().cuid() }),
]);

export async function GET(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;

  const params = new URL(request.url).searchParams;
  const status = params.get("status") ?? "OPEN";
  if (!["OPEN", "CONFIRMED", "DISMISSED", "ALL"].includes(status)) {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  }
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(10, Number(params.get("pageSize")) || 20));
  const where = status === "ALL" ? {} : { status: status as "OPEN" | "CONFIRMED" | "DISMISSED" };
  const [cases, total, statusCounts] = await Promise.all([
    prisma.postModerationCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        subject: { select: { id: true, name: true, handle: true, email: true, accountStatus: true, suspendedUntil: true } },
        post: {
          select: {
            id: true,
            type: true,
            content: true,
            tags: true,
            createdAt: true,
            moderationStatus: true,
            team: { select: { id: true, teamName: true, title: true } },
            project: { select: { id: true, teamName: true, title: true, parentTeam: { select: { id: true, teamName: true, title: true } } } },
          },
        },
      },
    }),
    prisma.postModerationCase.count({ where }),
    prisma.postModerationCase.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const counts = { OPEN: 0, CONFIRMED: 0, DISMISSED: 0 };
  for (const entry of statusCounts) counts[entry.status] = entry._count._all;
  return NextResponse.json({ cases, counts, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
}

export async function PATCH(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
  const input = parsed.data;

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const moderationCase = await transaction.postModerationCase.findUnique({
        where: { id: input.caseId },
        select: { id: true, subjectId: true, postId: true, status: true, reason: true },
      });
      if (!moderationCase) throw new Error("CASE_NOT_FOUND");
      if (moderationCase.status !== "OPEN") throw new Error("CASE_ALREADY_REVIEWED");

      const reviewedAt = new Date();
      const dismissed = input.action === "DISMISS";
      const updatedCase = await transaction.postModerationCase.update({
        where: { id: moderationCase.id },
        data: {
          status: dismissed ? "DISMISSED" : "CONFIRMED",
          reviewerId: access.admin.id,
          reviewedAt,
        },
      });
      await transaction.post.update({
        where: { id: moderationCase.postId },
        data: {
          moderationStatus: dismissed ? "APPROVED" : "REJECTED",
          reviewedBy: access.userId,
          reviewDate: reviewedAt,
        },
      });

      if (input.action === "CONFIRM") {
        const confirmedViolations = await transaction.postModerationCase.count({
          where: {
            subjectId: moderationCase.subjectId,
            confidence: { gte: 95 },
            status: "CONFIRMED",
            createdAt: { gte: new Date(reviewedAt.getTime() - 30 * 24 * 60 * 60 * 1000) },
          },
        });
        if (confirmedViolations >= 3) {
          const days = confirmedViolations >= 5 ? 30 : 7;
          await transaction.user.update({
            where: { id: moderationCase.subjectId },
            data: {
              accountStatus: "SUSPENDED",
              suspendedUntil: new Date(reviewedAt.getTime() + days * 24 * 60 * 60 * 1000),
              accountStatusReason: `Suspension après ${confirmedViolations} violations confirmées à forte confiance en 30 jours : ${moderationCase.reason}`,
            },
          });
        }
      } else if (input.action === "SUSPEND" || input.action === "BAN") {
        const suspendedUntil = input.action === "SUSPEND"
          ? new Date(reviewedAt.getTime() + input.days * 24 * 60 * 60 * 1000)
          : null;
        await transaction.user.update({
          where: { id: moderationCase.subjectId },
          data: {
            accountStatus: input.action === "BAN" ? "BANNED" : "SUSPENDED",
            suspendedUntil,
            accountStatusReason: moderationCase.reason,
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          adminId: access.admin.id,
          action: `MODERATION_${input.action}`,
          targetId: moderationCase.subjectId,
        },
      });
      return updatedCase;
    });
    return NextResponse.json({ moderationCase: result });
  } catch (error) {
    if (error instanceof Error && error.message === "CASE_NOT_FOUND") {
      return NextResponse.json({ error: "CASE_NOT_FOUND" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "CASE_ALREADY_REVIEWED") {
      return NextResponse.json({ error: "CASE_ALREADY_REVIEWED" }, { status: 409 });
    }
    console.error("Admin moderation review error:", error);
    return NextResponse.json({ error: "MODERATION_REVIEW_FAILED" }, { status: 500 });
  }
}
