import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createCodingCollaborationTicket, resolveCodingWorkspaceForRequest } from "@/lib/coding-workspaces";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  filePath: z.string().min(1).max(512).refine((value) =>
    !value.startsWith("/") &&
    !value.includes("\\") &&
    value.split("/").every((part) => part && part !== "." && part !== ".."),
  ),
});

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
  const { id: teamId } = await props.params;
  const teamRequest = new Request(request.url, {
    headers: { "x-lynora-coding-team": teamId },
  });

  try {
    const access = await resolveCodingWorkspaceForRequest(session.user.id, teamRequest);
    if (!access) return NextResponse.json({ error: "TEAM_ACCESS_REQUIRED" }, { status: 403 });
    const file = await prisma.codingFile.findUnique({
      where: {
        workspaceId_path: {
          workspaceId: access.workspace.id,
          path: parsed.data.filePath,
        },
      },
      select: { isDirectory: true },
    });
    if (!file || file.isDirectory) return NextResponse.json({ error: "FILE_NOT_FOUND" }, { status: 404 });

    const ticket = createCodingCollaborationTicket({
      teamId,
      filePath: parsed.data.filePath,
      userId: session.user.id,
      userName: session.user.name?.trim() || session.user.email || "Team member",
      role: access.role,
    });
    return NextResponse.json({
      ticket,
      role: access.role,
      user: { id: session.user.id, name: session.user.name?.trim() || "Team member" },
      websocketUrl: process.env.CODING_WS_URL || "ws://localhost:4001",
    });
  } catch (error) {
    console.error("Unable to create a team coding collaboration session:", error);
    return NextResponse.json({ error: "Unable to start team collaboration." }, { status: 500 });
  }
}
