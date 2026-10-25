import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const reviewStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
const projectStatuses = ["IDEA", "DEVELOPMENT", "LAUNCHED"] as const;
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["APPROVE", "REJECT"]), projectId: z.string().cuid() }),
  z.object({ action: z.literal("FEATURE"), projectId: z.string().cuid(), featured: z.boolean() }),
  z.object({ action: z.literal("SET_STATUS"), projectId: z.string().cuid(), status: z.enum(projectStatuses) }),
]);
const deleteSchema = z.object({ projectId: z.string().cuid() });

const projectSummarySelect = {
  id: true,
  title: true,
  tagline: true,
  description: true,
  coverUrl: true,
  logoUrl: true,
  teamName: true,
  status: true,
  moderationStatus: true,
  reviewedBy: true,
  reviewDate: true,
  isFeatured: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: { id: true, name: true, handle: true, email: true } },
  _count: { select: { collaborators: true, posts: true, tasks: true, feedback: true } },
} satisfies Prisma.ProjectSelect;

export async function GET(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const params = new URL(request.url).searchParams;
  const projectId = params.get("id");
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, teamName: null },
      select: {
        ...projectSummarySelect,
        description: true,
        teamDescription: true,
        githubUrl: true,
        liveUrl: true,
        techStack: true,
        tasks: { orderBy: [{ position: "asc" }, { createdAt: "desc" }], take: 50, select: { id: true, title: true, status: true, assignee: { select: { id: true, name: true, handle: true } } } },
        collaborators: { orderBy: { createdAt: "asc" }, take: 100, select: { id: true, role: true, status: true, user: { select: { id: true, name: true, handle: true, email: true } } } },
        posts: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, type: true, content: true, createdAt: true, _count: { select: { likes: true, comments: true } } } },
      },
    });
    if (!project) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ project });
  }

  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(10, Number(params.get("pageSize")) || 20));
  const search = params.get("q")?.trim();
  const requestedReviewStatus = params.get("reviewStatus") ?? "ALL";
  const requestedProjectStatus = params.get("status") ?? "ALL";
  if (requestedReviewStatus !== "ALL" && !reviewStatuses.includes(requestedReviewStatus as typeof reviewStatuses[number])) return NextResponse.json({ error: "INVALID_REVIEW_STATUS" }, { status: 400 });
  if (requestedProjectStatus !== "ALL" && !projectStatuses.includes(requestedProjectStatus as typeof projectStatuses[number])) return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });

  const where: Prisma.ProjectWhereInput = {
    teamName: null,
    ...(requestedReviewStatus === "ALL" ? {} : { moderationStatus: requestedReviewStatus as typeof reviewStatuses[number] }),
    ...(requestedProjectStatus === "ALL" ? {} : { status: requestedProjectStatus as typeof projectStatuses[number] }),
    ...(search ? { OR: [
      { title: { contains: search, mode: "insensitive" } },
      { tagline: { contains: search, mode: "insensitive" } },
      { teamName: { contains: search, mode: "insensitive" } },
    ] } : {}),
  };
  const [projects, total, reviewCounts] = await Promise.all([
    prisma.project.findMany({ where, orderBy: [{ moderationStatus: "asc" }, { updatedAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize, select: projectSummarySelect }),
    prisma.project.count({ where }),
    prisma.project.groupBy({ by: ["moderationStatus"], where: { teamName: null }, _count: { _all: true } }),
  ]);
  return NextResponse.json({
    projects,
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
    reviewCounts: Object.fromEntries(reviewCounts.map(({ moderationStatus, _count }) => [moderationStatus, _count._all])),
  });
}

export async function PATCH(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  const input = parsed.data;
  try {
    const project = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.project.update({
        where: { id: input.projectId },
        data: input.action === "FEATURE"
          ? { isFeatured: input.featured }
          : input.action === "SET_STATUS"
            ? { status: input.status }
            : { moderationStatus: input.action === "APPROVE" ? "APPROVED" : "REJECTED", reviewedBy: access.userId, reviewDate: new Date() },
        select: { id: true, title: true, moderationStatus: true, status: true, isFeatured: true },
      });
      await transaction.auditLog.create({ data: { adminId: access.admin.id, action: `ADMIN_PROJECT_${input.action}`, targetId: input.projectId } });
      return updated;
    });
    return NextResponse.json({ project });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    console.error("Admin project action error:", error);
    return NextResponse.json({ error: "PROJECT_ACTION_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.project.delete({ where: { id: parsed.data.projectId } });
      await transaction.auditLog.create({ data: { adminId: access.admin.id, action: "ADMIN_PROJECT_DELETE", targetId: parsed.data.projectId } });
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    console.error("Admin project delete error:", error);
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
}