import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { updateProjectSchema } from "@/lib/validators";
import { recordInteraction } from "@/lib/gamification";
import { ADMIN_EMAIL } from "@/lib/admin";
import { canViewProject } from "@/lib/project-access";

type RouteContext = { params: Promise<{ id: string }> };

async function ownedProject(id: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.creatorId !== userId) return null;
  return project;
}

export async function GET(_request: Request, props: RouteContext) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      creator: {
        select: {
          id: true, name: true, handle: true, image: true,
          userBadges: { select: { awardedAt: true, badge: { select: { key: true, name: true, icon: true } } } },
        },
      },
      parentTeam: {
        select: { id: true, title: true, teamName: true, logoUrl: true },
      },
      collaborators: {
        where: { status: "APPROVED" },
        select: {
          userId: true,
          role: true,
          user: {
            select: {
              id: true, name: true, handle: true, image: true,
              userBadges: { select: { awardedAt: true, badge: { select: { key: true, name: true, icon: true } } } },
            },
          },
        },
      },
      _count: {
        select: {
          collaborators: { where: { status: "APPROVED" } },
          posts: true,
          tasks: true,
          feedback: true,
        },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const canContribute = project.creatorId === session.user.id || project.collaborators.some((member) => member.userId === session.user.id);
  const isAdmin = session.user.email?.toLowerCase() === ADMIN_EMAIL;
  if (!(await canViewProject(params.id, session.user.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (project.moderationStatus !== "APPROVED" && !canContribute && !isAdmin) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const { moderationStatus, reviewedBy, reviewDate, ...publicProject } = project;
  const withBadges = <T extends { userBadges: { awardedAt: Date; badge: { key: string; name: string; icon: string } }[] }>({ userBadges, ...user }: T) => ({
    ...user,
    badges: userBadges.map(({ badge, awardedAt }) => ({ key: badge.key, name: badge.name, icon: badge.icon, awardedAt })),
  });
  return NextResponse.json({
    isOwner: project.creatorId === session.user.id,
    project: {
      ...publicProject,
      creator: withBadges(publicProject.creator),
      collaborators: publicProject.collaborators.map((member) => ({ ...member, user: withBadges(member.user) })),
    },
    canContribute,
  });
}

export async function PATCH(request: Request, props: RouteContext) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const currentProject = await ownedProject(params.id, session.user.id);
  if (!currentProject) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const data = parsed.data;
  let slug = currentProject.slug;
  if (data.title !== currentProject.title) {
    const baseSlug = slugify(data.title) || "team";
    slug = baseSlug;
    let suffix = 1;
    while (true) {
      const match = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
      if (!match || match.id === currentProject.id) break;
      slug = `${baseSlug}-${suffix++}`;
    }
  }

  const project = await prisma.project.update({
    where: { id: currentProject.id },
    data: {
      title: data.title,
      ...(data.teamName !== undefined ? { teamName: data.teamName } : {}),
      slug,
      tagline: data.tagline,
      description: data.description,
      ...(data.teamDescription !== undefined ? { teamDescription: data.teamDescription } : {}),
      ...(data.teamRules !== undefined ? { teamRules: data.teamRules || null } : {}),
      ...(data.isPrivate !== undefined ? { isPrivate: data.isPrivate } : {}),
      logoUrl: data.logoUrl || null,
      ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl || null } : {}),
      status: data.status,
      githubUrl: data.githubUrl || null,
      liveUrl: data.liveUrl || null,
      ...(data.docsUrl !== undefined ? { docsUrl: data.docsUrl || null } : {}),
      ...(data.pitchDeckUrl !== undefined ? { pitchDeckUrl: data.pitchDeckUrl || null } : {}),
      techStack: [...new Set(data.techStack)],
      tags: [...new Set(data.tags)],
      lookingFor: [...new Set(data.lookingFor)],
    },
  });

  await recordInteraction(session.user.id, "PROJECT", project.id, `${session.user.id}:PROJECT_UPDATE:${project.id}:${project.updatedAt.getTime()}`);
  return NextResponse.json({ project });
}

export async function DELETE(_request: Request, props: RouteContext) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const project = await ownedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await prisma.$transaction([
    prisma.post.deleteMany({ where: { OR: [{ projectId: params.id }, { teamId: params.id }] } }),
    prisma.review.deleteMany({ where: { targetId: params.id } }),
    prisma.huddle.deleteMany({ where: { projectId: params.id } }),
    prisma.notification.deleteMany({ where: { targetId: params.id } }),
    prisma.project.delete({ where: { id: params.id } }),
  ]);
  return NextResponse.json({ deleted: true });
}