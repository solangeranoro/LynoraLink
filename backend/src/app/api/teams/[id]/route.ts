import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewProject } from "@/lib/project-access";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();

  const team = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      creatorId: true,
      title: true,
      teamName: true,
      isTeamVerified: true,
      slug: true,
      tagline: true,
      description: true,
      teamDescription: true,
      teamRules: true,
      isPrivate: true,
      status: true,
      logoUrl: true,
      githubUrl: true,
      liveUrl: true,
      docsUrl: true,
      pitchDeckUrl: true,
      techStack: true,
      tags: true,
      lookingFor: true,
      collaborationQuestions: true,
      collaborationForm: true,
      createdAt: true,
      creator: { select: { id: true, name: true, image: true, handle: true, headline: true } },
      collaborators: {
        where: { status: "APPROVED" },
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true, image: true, handle: true, headline: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { teamPosts: true } },
    },
  });
  if (!team?.teamName?.trim()) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const membership = session?.user?.id
    ? await prisma.projectCollaborator.findUnique({
      where: { projectId_userId: { projectId: params.id, userId: session.user.id } },
      select: { id: true, status: true, role: true, invitedById: true },
    })
    : null;
  const isOwner = Boolean(session?.user?.id && team.creatorId === session.user.id);
  if (!(await canViewProject(params.id, session?.user?.id))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    team: {
      ...team,
      isOwner,
      currentMembership: membership,
      memberCount: team.collaborators.length,
      postCount: team._count.teamPosts,
    },
  });
}