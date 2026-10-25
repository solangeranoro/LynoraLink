import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const reviewStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
const memberStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
const memberRoles = ["FOUNDER", "CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"] as const;
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["APPROVE", "REJECT"]), teamId: z.string().cuid() }),
  z.object({ action: z.literal("SET_VERIFICATION"), teamId: z.string().cuid(), verified: z.boolean() }),
  z.object({ action: z.literal("MEMBER"), teamId: z.string().cuid(), collaboratorId: z.string().cuid(), status: z.enum(memberStatuses), role: z.enum(memberRoles).optional() }),
]);
const dissolveSchema = z.object({ teamId: z.string().cuid() });

export async function GET(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const params = new URL(request.url).searchParams;
  const teamId = params.get("id");
  if (teamId) {
    const team = await prisma.project.findFirst({
      where: { id: teamId, teamName: { not: null } },
      select: {
        id: true, title: true, teamName: true, teamDescription: true, status: true,
        moderationStatus: true, reviewedBy: true, reviewDate: true, isTeamVerified: true, createdAt: true, updatedAt: true,
        creator: { select: { id: true, name: true, handle: true, email: true } },
        collaborators: { orderBy: { createdAt: "asc" }, take: 100, select: { id: true, role: true, status: true, createdAt: true, user: { select: { id: true, name: true, handle: true, email: true } } } },
        teamPosts: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, type: true, content: true, createdAt: true, _count: { select: { likes: true, comments: true } } } },
        _count: { select: { collaborators: true, teamPosts: true } },
      },
    });
    if (!team) return NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 404 });
    const associatedProjects = await prisma.project.findMany({
      where: { teamName: team.teamName },
      select: { id: true, title: true, status: true, moderationStatus: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ team, associatedProjects });
  }

  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(10, Number(params.get("pageSize")) || 20));
  const search = params.get("q")?.trim();
  const requestedStatus = params.get("status") ?? "ALL";
  if (requestedStatus !== "ALL" && !reviewStatuses.includes(requestedStatus as typeof reviewStatuses[number])) return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  const where: Prisma.ProjectWhereInput = {
    teamName: { not: null },
    ...(requestedStatus === "ALL" ? {} : { moderationStatus: requestedStatus as typeof reviewStatuses[number] }),
    ...(search ? { OR: [
      { teamName: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
    ] } : {}),
  };
  const [teams, total, statusCounts] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: [{ moderationStatus: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, title: true, teamName: true, tagline: true, description: true, teamDescription: true,
        logoUrl: true, coverUrl: true, status: true, moderationStatus: true, isTeamVerified: true,
        reviewedBy: true, reviewDate: true, createdAt: true, updatedAt: true,
        creator: { select: { id: true, name: true, handle: true } },
        _count: { select: { collaborators: true, teamPosts: true, teamProjects: true } },
      },
    }),
    prisma.project.count({ where }),
    prisma.project.groupBy({ by: ["moderationStatus"], where: { teamName: { not: null } }, _count: { _all: true } }),
  ]);
  return NextResponse.json({
    teams,
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
    statusCounts: Object.fromEntries(statusCounts.map(({ moderationStatus, _count }) => [moderationStatus, _count._all])),
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
      let team;
      if (input.action === "MEMBER") {
        const membership = await transaction.projectCollaborator.findFirst({ where: { id: input.collaboratorId, projectId: input.teamId } });
        if (!membership) throw new Error("MEMBER_NOT_FOUND");
        await transaction.projectCollaborator.update({
          where: { id: membership.id },
          data: { status: input.status, ...(input.role ? { role: input.role } : {}) },
        });
        team = { id: input.teamId, memberId: membership.id, status: input.status };
      } else if (input.action === "SET_VERIFICATION") {
        team = await transaction.project.update({
          where: { id: input.teamId },
          data: { isTeamVerified: input.verified },
          select: { id: true, teamName: true, isTeamVerified: true },
        });
      } else {
        team = await transaction.project.update({
          where: { id: input.teamId },
          data: {
            moderationStatus: input.action === "APPROVE" ? "APPROVED" : "REJECTED",
            reviewedBy: access.userId,
            reviewDate: new Date(),
          },
          select: { id: true, teamName: true, moderationStatus: true },
        });
      }
      await transaction.auditLog.create({ data: { adminId: access.admin.id, action: `ADMIN_TEAM_${input.action}`, targetId: input.teamId } });
      return team;
    });
    return NextResponse.json({ team: result });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_NOT_FOUND") return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 404 });
    console.error("Admin team action error:", error);
    return NextResponse.json({ error: "TEAM_ACTION_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const parsed = dissolveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
  try {
    await prisma.$transaction(async (transaction) => {
      const team = await transaction.project.findFirst({ where: { id: parsed.data.teamId, teamName: { not: null } }, select: { id: true } });
      if (!team) throw new Error("TEAM_NOT_FOUND");
      await transaction.project.delete({ where: { id: team.id } });
      await transaction.auditLog.create({ data: { adminId: access.admin.id, action: "ADMIN_TEAM_DISSOLVE", targetId: team.id } });
    });
    return NextResponse.json({ dissolved: true });
  } catch (error) {
    if (error instanceof Error && error.message === "TEAM_NOT_FOUND") return NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 404 });
    console.error("Admin team dissolve error:", error);
    return NextResponse.json({ error: "DISSOLVE_FAILED" }, { status: 500 });
  }
}