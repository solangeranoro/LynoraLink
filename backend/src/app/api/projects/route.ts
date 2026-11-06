import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProjectSchema } from "@/lib/validators";
import { slugify } from "@/lib/utils";
import { recordInteraction } from "@/lib/gamification";
import { canViewProject } from "@/lib/project-access";
import { applyAutomaticAccountRestriction, assessPostContent, notifyTeamModerationReview } from "@/lib/post-moderation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const mine = searchParams.get("mine") === "1";
  const discoverProjects = searchParams.get("discover") === "1";
  const discoverTag = searchParams.get("tag")?.trim();
  const projectScope = searchParams.get("projects") === "1";
  const teamScope = searchParams.get("teams");
  const teams = teamScope === "1";
  const discoverTeams = teamScope === "discover";
  const parentTeamId = searchParams.get("teamId");
  const session = await auth();
  if ((teams || mine || projectScope || parentTeamId) && !session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (parentTeamId && !(await canViewProject(parentTeamId, session?.user?.id))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const now = new Date();
  const where = {
    ...(status ? { status: status as never } : {}),
    ...(parentTeamId
      ? { parentTeamId }
      : teams || discoverTeams
        ? { teamName: { not: null } }
        : { teamName: null }),
    ...(!mine && !teams && !projectScope && !parentTeamId
      ? { isPrivate: false, AND: [{ OR: [{ parentTeamId: null }, { moderationStatus: "APPROVED" as const }] }] }
      : {}),
    ...(parentTeamId ? { moderationStatus: "APPROVED" as const } : {}),
    ...(discoverProjects && discoverTag
      ? {
        OR: [
          { title: { contains: discoverTag, mode: "insensitive" as const } },
          { tags: { has: discoverTag } },
          { techStack: { has: discoverTag } },
        ],
      }
      : {}),
    ...(discoverProjects && session?.user?.id ? { creatorId: { not: session.user.id } } : {}),
    ...(discoverTeams ? { isPrivate: false } : {}),
    ...((teams || projectScope) && session?.user?.id
      ? {
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "APPROVED" as const } } },
          { collaborators: { some: { userId: session.user.id, status: "PENDING" as const, invitedById: { not: null } } } },
          ...(projectScope ? [{ parentTeam: { collaborators: { some: { userId: session.user.id, status: "APPROVED" as const } } } }] : []),
        ],
      }
      : mine && session?.user?.id
        ? { creatorId: session.user.id }
        : {}),
  };
  const include = {
    creator: { select: { id: true, name: true, image: true, handle: true } },
    parentTeam: { select: { id: true, title: true, teamName: true, logoUrl: true } },
    collaborators: { include: { user: { select: { id: true, name: true, image: true } } } },
    _count: { select: { collaborators: true, posts: true, teamPosts: true } },
    boosts: { where: { expiresAt: { gt: now } }, select: { id: true } },
  };
  const pageParameter = searchParams.get("page");
  if (discoverProjects && pageParameter !== null) {
    const requestedPage = Number.parseInt(pageParameter, 10);
    const pageSize = 6;
    const boostedWhere = { ...where, boosts: { some: { expiresAt: { gt: now } } } };
    const unboostedWhere = { ...where, boosts: { none: { expiresAt: { gt: now } } } };
    const [total, boostedTotal] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.count({ where: boostedWhere }),
    ]);
    const pageCount = Math.ceil(total / pageSize);
    const page = Number.isFinite(requestedPage)
      ? Math.min(Math.max(1, requestedPage), Math.max(1, pageCount))
      : 1;
    const offset = (page - 1) * pageSize;
    const boostedSkip = Math.min(offset, boostedTotal);
    const boostedTake = Math.max(0, Math.min(pageSize, boostedTotal - boostedSkip));
    const unboostedSkip = Math.max(0, offset - boostedTotal);
    const unboostedTake = pageSize - boostedTake;
    const orderBy = [{ isFeatured: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }];
    const [boostedProjects, unboostedProjects] = await Promise.all([
      boostedTake > 0
        ? prisma.project.findMany({ where: boostedWhere, include, orderBy, skip: boostedSkip, take: boostedTake })
        : Promise.resolve([]),
      unboostedTake > 0
        ? prisma.project.findMany({ where: unboostedWhere, include, orderBy, skip: unboostedSkip, take: unboostedTake })
        : Promise.resolve([]),
    ]);
    const projects = [...boostedProjects, ...unboostedProjects];
    return NextResponse.json({
      projects: projects.map(({ boosts, moderationStatus, reviewedBy, reviewDate, ...project }) => ({
        ...project,
        activeBoost: boosts.length > 0,
      })),
      pagination: { page, pageSize, total, pageCount },
    });
  }
  if (mine && pageParameter !== null) {
    const requestedPage = Number.parseInt(pageParameter, 10);
    const pageSize = 6;
    const total = await prisma.project.count({ where });
    const pageCount = Math.ceil(total / pageSize);
    const page = Number.isFinite(requestedPage)
      ? Math.min(Math.max(1, requestedPage), Math.max(1, pageCount))
      : 1;
    const projects = await prisma.project.findMany({
      where,
      include,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return NextResponse.json({
      projects: projects.map(({ boosts, moderationStatus, reviewedBy, reviewDate, ...project }) => ({
        ...project,
        activeBoost: boosts.length > 0,
      })),
      pagination: { page, pageSize, total, pageCount },
    });
  }
  const [recentProjects, boostedProjects] = await Promise.all([
    prisma.project.findMany({ where, include, orderBy: { createdAt: "desc" }, take: 50 }),
    !mine && !teams && !projectScope && !discoverTeams && !parentTeamId
      ? prisma.project.findMany({ where: { ...where, boosts: { some: { expiresAt: { gt: now } } } }, include, orderBy: { createdAt: "desc" }, take: 50 })
      : Promise.resolve([]),
  ]);
  const recentIds = new Set(recentProjects.map((project) => project.id));
  const projects = [...recentProjects, ...boostedProjects.filter((project) => !recentIds.has(project.id))];
  const rankedProjects = projects
    .map(({ boosts, moderationStatus, reviewedBy, reviewDate, ...project }) => ({ ...project, activeBoost: boosts.length > 0 }))
    .sort((first, second) => Number(second.activeBoost) - Number(first.activeBoost) || Number(second.isFeatured) - Number(first.isFeatured) || second.createdAt.getTime() - first.createdAt.getTime());
  return NextResponse.json({ projects: rankedProjects });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const parsed = createProjectSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const data = parsed.data;
    const moderationAssessment = assessPostContent(`${data.title}\n${data.tagline}\n${data.description}`, data.tags);
    async function uniqueSlug(title: string, reserved: Set<string> = new Set()) {
      const baseSlug = slugify(title);
      let slug = baseSlug;
      let index = 1;
      while (reserved.has(slug) || await prisma.project.findUnique({ where: { slug } })) slug = `${baseSlug}-${index++}`;
      return slug;
    }

    if (data.teamName) {
      const teamSlug = await uniqueSlug(data.teamName);
      const projectSlug = await uniqueSlug(data.title, new Set([teamSlug]));
      const { team, project } = await prisma.$transaction(async (transaction) => {
        const team = await transaction.project.create({
          data: {
            title: data.teamName!,
            teamName: data.teamName,
            slug: teamSlug,
            tagline: data.tagline,
            description: data.teamDescription ?? data.description,
            teamDescription: data.teamDescription ?? null,
            teamRules: data.teamRules ?? null,
            isPrivate: data.isPrivate ?? false,
            logoUrl: data.logoUrl || null,
            coverUrl: null,
            status: data.status,
            techStack: data.techStack,
            lookingFor: data.lookingFor,
            creatorId: session.user.id,
            moderationStatus: "APPROVED",
            collaborators: { create: { userId: session.user.id, role: "FOUNDER", status: "APPROVED" } },
          },
        });
        const project = await transaction.project.create({
          data: {
            title: data.title,
            slug: projectSlug,
            tagline: data.tagline,
            description: data.description,
            status: data.status,
            githubUrl: data.githubUrl || null,
            liveUrl: data.liveUrl || null,
            docsUrl: data.docsUrl || null,
            pitchDeckUrl: data.pitchDeckUrl || null,
            logoUrl: data.logoUrl || null,
            coverUrl: data.coverUrl || null,
            techStack: data.techStack,
            tags: data.tags,
            lookingFor: data.lookingFor,
            creatorId: session.user.id,
            parentTeamId: team.id,
            moderationStatus: "APPROVED",
            collaborators: { create: { userId: session.user.id, role: "FOUNDER", status: "APPROVED" } },
          },
        });
        await transaction.post.create({
          data: {
            type: "PROJECT",
            content: data.description,
            ...(moderationAssessment
              ? { moderationStatus: moderationAssessment.status === "REJECTED" ? "REJECTED" as const : "PENDING" as const }
              : {}),
            moderationCases: moderationAssessment ? {
              create: {
                category: moderationAssessment.category,
                confidence: moderationAssessment.confidence,
                reason: moderationAssessment.reason,
                subjectId: session.user.id,
              },
            } : undefined,
            authorId: session.user.id,
            projectId: project.id,
            teamId: team.id,
          },
        });
        return { team, project };
      });
      const accountRestriction = await applyAutomaticAccountRestriction(session.user.id, moderationAssessment);
      await recordInteraction(session.user.id, "PROJECT", project.id);
      return NextResponse.json({
        team,
        project,
        moderation: moderationAssessment ? { status: moderationAssessment.status, reason: moderationAssessment.reason } : null,
        accountSuspended: accountRestriction !== null,
      }, { status: 201 });
    }

    if (data.parentTeamId) {
      const parentTeam = await prisma.project.findUnique({
        where: { id: data.parentTeamId },
        select: {
          id: true,
          creatorId: true,
          teamName: true,
          isPrivate: true,
          collaborators: {
            where: { status: "APPROVED" },
            select: { userId: true, role: true },
          },
        },
      });
      if (!parentTeam?.teamName?.trim()) {
        return NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 404 });
      }
      if (parentTeam.creatorId !== session.user.id
        && !parentTeam.collaborators.some((member) => member.userId === session.user.id)) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }

      const slug = await uniqueSlug(data.title);
      const project = await prisma.$transaction(async (transaction) => {
        const project = await transaction.project.create({
          data: {
            title: data.title,
            slug,
            tagline: data.tagline,
            description: data.description,
            isPrivate: parentTeam.isPrivate,
            status: data.status,
            githubUrl: data.githubUrl || null,
            liveUrl: data.liveUrl || null,
            docsUrl: data.docsUrl || null,
            pitchDeckUrl: data.pitchDeckUrl || null,
            logoUrl: data.logoUrl || null,
            coverUrl: data.coverUrl || null,
            techStack: data.techStack,
            tags: data.tags,
            lookingFor: data.lookingFor,
            creatorId: session.user.id,
            parentTeamId: parentTeam.id,
            moderationStatus: parentTeam.creatorId === session.user.id ? "APPROVED" : "PENDING",
            collaborators: {
              create: [
                { userId: session.user.id, role: "FOUNDER", status: "APPROVED" },
                ...parentTeam.collaborators
                  .filter((member) => member.userId !== session.user.id)
                  .map((member) => ({ userId: member.userId, role: member.role, status: "APPROVED" as const })),
              ],
            },
          },
        });
        await transaction.post.create({
          data: {
            type: "PROJECT",
            content: data.description,
            ...(moderationAssessment
              ? { moderationStatus: moderationAssessment.status === "REJECTED" ? "REJECTED" as const : "PENDING" as const }
              : {}),
            moderationCases: moderationAssessment ? {
              create: {
                category: moderationAssessment.category,
                confidence: moderationAssessment.confidence,
                reason: moderationAssessment.reason,
                subjectId: session.user.id,
              },
            } : undefined,
            authorId: session.user.id,
            projectId: project.id,
            teamId: parentTeam.id,
          },
        });
        return project;
      });
      if (moderationAssessment) {
        await notifyTeamModerationReview(parentTeam.creatorId, session.user.id, parentTeam.id);
      }
      const accountRestriction = await applyAutomaticAccountRestriction(session.user.id, moderationAssessment);
      await recordInteraction(session.user.id, "PROJECT", project.id);
      return NextResponse.json({
        project,
        moderation: moderationAssessment ? { status: moderationAssessment.status, reason: moderationAssessment.reason } : null,
        accountSuspended: accountRestriction !== null,
        teamApprovalRequired: project.moderationStatus === "PENDING",
      }, { status: 201 });
    }

    const slug = await uniqueSlug(data.title);
    const project = await prisma.$transaction(async (transaction) => {
      const project = await transaction.project.create({
        data: {
          title: data.title,
          slug,
          tagline: data.tagline,
          description: data.description,
          isPrivate: data.isPrivate ?? false,
          logoUrl: data.logoUrl || null,
          coverUrl: data.coverUrl || null,
          status: data.status,
          githubUrl: data.githubUrl || null,
          liveUrl: data.liveUrl || null,
          docsUrl: data.docsUrl || null,
          pitchDeckUrl: data.pitchDeckUrl || null,
          techStack: data.techStack,
          tags: data.tags,
          lookingFor: data.lookingFor,
          collaborationQuestions: data.collaborationQuestions,
          creatorId: session.user.id,
          moderationStatus: "APPROVED",
          collaborators: { create: { userId: session.user.id, role: "FOUNDER", status: "APPROVED" } },
        },
      });
      await transaction.post.create({
        data: {
          type: "PROJECT",
          content: data.description,
          ...(moderationAssessment
            ? { moderationStatus: moderationAssessment.status === "REJECTED" ? "REJECTED" as const : "PENDING" as const }
            : {}),
          moderationCases: moderationAssessment ? {
            create: {
              category: moderationAssessment.category,
              confidence: moderationAssessment.confidence,
              reason: moderationAssessment.reason,
              subjectId: session.user.id,
            },
          } : undefined,
          authorId: session.user.id,
          projectId: project.id,
        },
      });
      return project;
    });
    const accountRestriction = await applyAutomaticAccountRestriction(session.user.id, moderationAssessment);
    await recordInteraction(session.user.id, "PROJECT", project.id);
    return NextResponse.json({
      project,
      moderation: moderationAssessment ? { status: moderationAssessment.status, reason: moderationAssessment.reason } : null,
      accountSuspended: accountRestriction !== null,
      teamApprovalRequired: false,
    }, { status: 201 });
  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}