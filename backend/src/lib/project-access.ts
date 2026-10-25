import { prisma } from "@/lib/prisma";

export async function canContributeToProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      creatorId: true,
      collaborators: { where: { userId, status: "APPROVED" }, select: { id: true } },
    },
  });
  return Boolean(project && (project.creatorId === userId || project.collaborators.length > 0));
}

export async function canViewProject(projectId: string, userId?: string | null) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { isPrivate: true, creatorId: true, parentTeamId: true },
  });
  if (!project) return false;
  if (!project.isPrivate) return true;
  if (!userId) return false;
  if (project.creatorId === userId) return true;

  const membership = await prisma.projectCollaborator.findFirst({
    where: {
      projectId,
      userId,
      OR: [
        { status: "APPROVED" },
        { status: "PENDING", invitedById: { not: null } },
      ],
    },
    select: { id: true },
  });
  if (membership) return true;
  if (!project.parentTeamId) return false;
  const teamMembership = await prisma.projectCollaborator.findFirst({
    where: {
      projectId: project.parentTeamId,
      userId,
      OR: [
        { status: "APPROVED" },
        { status: "PENDING", invitedById: { not: null } },
      ],
    },
    select: { id: true },
  });
  return Boolean(teamMembership);
}

export async function canViewPost(postId: string, userId?: string | null) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { projectId: true, teamId: true },
  });
  if (!post) return false;

  const projectIds = [...new Set([post.projectId, post.teamId].filter((id): id is string => Boolean(id)))];
  const access = await Promise.all(projectIds.map((projectId) => canViewProject(projectId, userId)));
  return access.every(Boolean);
}