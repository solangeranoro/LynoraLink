import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

const LEGACY_CLIENT_ID = "legacy";
const WORKSPACE_CLIENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CodingWorkspaceAccess = {
  workspace: Awaited<ReturnType<typeof resolveCodingWorkspace>>;
  role: "LEADER" | "CONTRIBUTOR" | "OBSERVER";
  userId: string;
};

export function getCodingWorkspaceClientId(request: Request): string | null {
  const clientId = request.headers.get("x-lynora-coding-workspace");
  return clientId && WORKSPACE_CLIENT_ID_PATTERN.test(clientId) ? clientId : null;
}

export function getCodingWorkspaceTeamId(request: Request): string | null {
  const teamId = request.headers.get("x-lynora-coding-team");
  return teamId && /^[a-zA-Z0-9_-]{1,64}$/.test(teamId) ? teamId : null;
}

export async function resolveCodingWorkspace(ownerId: string, clientId: string) {
  return prisma.$transaction(async (transaction) => {
    await transaction.codingWorkspace.updateMany({
      where: { ownerId, clientId: LEGACY_CLIENT_ID },
      data: { clientId },
    });

    return transaction.codingWorkspace.upsert({
      where: { ownerId_clientId: { ownerId, clientId } },
      create: { ownerId, clientId },
      update: {},
    });
  });
}

export async function resolveCodingWorkspaceForRequest(
  userId: string,
  request: Request,
): Promise<CodingWorkspaceAccess | null> {
  const teamId = getCodingWorkspaceTeamId(request);
  if (!teamId) {
    const clientId = getCodingWorkspaceClientId(request);
    if (!clientId) throw new Error("A valid coding workspace window ID is required.");
    return {
      workspace: await resolveCodingWorkspace(userId, clientId),
      role: "LEADER",
      userId,
    };
  }

  const team = await prisma.project.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      title: true,
      teamName: true,
      creatorId: true,
      collaborators: {
        where: { userId, status: "APPROVED" },
        select: { codingRole: true },
        take: 1,
      },
    },
  });
  if (!team?.teamName?.trim()) return null;

  let role: CodingWorkspaceAccess["role"];
  if (team.creatorId === userId) {
    role = "LEADER";
  } else if (team.collaborators[0]) {
    role = team.collaborators[0].codingRole;
  } else {
    return null;
  }

  const workspace = await prisma.codingWorkspace.upsert({
    where: { teamId },
    create: {
      ownerId: team.creatorId,
      clientId: `team:${teamId}`,
      teamId,
      name: `${team.teamName} Workspace`,
    },
    update: { name: `${team.teamName} Workspace` },
  });

  return { workspace, role, userId };
}

export function createCodingCollaborationTicket(payload: {
  teamId: string;
  filePath: string;
  userId: string;
  userName: string;
  role: CodingWorkspaceAccess["role"];
}): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for coding collaboration.");
  const encodedPayload = Buffer.from(JSON.stringify({
    ...payload,
    expiresAt: Date.now() + 8 * 60 * 60 * 1_000,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}
