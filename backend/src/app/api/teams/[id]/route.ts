import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewProject } from "@/lib/project-access";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const team = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      creatorId: true,
      title: true,
      teamName: true,
      isTeamVerified: true,
      moderationStatus: true,
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

  const membership = await prisma.projectCollaborator.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: session.user.id } },
    select: { id: true, status: true, role: true, invitedById: true },
  });
  const isOwner = team.creatorId === session.user.id;
  const canViewUnapprovedTeam = isOwner
    || membership?.status === "APPROVED"
    || (membership?.status === "PENDING" && Boolean(membership.invitedById));
  if (!(await canViewProject(params.id, session.user.id)) || (team.moderationStatus !== "APPROVED" && !canViewUnapprovedTeam)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { moderationStatus: _moderationStatus, ...teamDetails } = team;

  return NextResponse.json({
    team: {
      ...teamDetails,
      isOwner,
      currentMembership: membership,
      memberCount: team.collaborators.length,
      postCount: team._count.teamPosts,
    },
  });
}