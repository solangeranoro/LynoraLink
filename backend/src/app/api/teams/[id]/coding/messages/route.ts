import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { resolveCodingWorkspaceForRequest } from "@/lib/coding-workspaces";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const messageSchema = z.object({ content: z.string().trim().min(1).max(2_000) });

async function teamWorkspace(request: Request, teamId: string, userId: string) {
  return resolveCodingWorkspaceForRequest(
    userId,
    new Request(request.url, { headers: { "x-lynora-coding-team": teamId } }),
  );
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await props.params;

  try {
    const access = await teamWorkspace(request, id, session.user.id);
    if (!access) return NextResponse.json({ error: "TEAM_ACCESS_REQUIRED" }, { status: 403 });
    const messages = await prisma.codingWorkspaceMessage.findMany({
      where: { workspaceId: access.workspace.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, name: true, image: true } },
      },
    });
    return NextResponse.json({ messages: messages.reverse() });
  } catch (error) {
    console.error("Unable to load team coding discussion:", error);
    return NextResponse.json({ error: "Unable to load team discussion." }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid discussion message." }, { status: 400 });
  const { id } = await props.params;

  try {
    const access = await teamWorkspace(request, id, session.user.id);
    if (!access) return NextResponse.json({ error: "TEAM_ACCESS_REQUIRED" }, { status: 403 });
    const message = await prisma.codingWorkspaceMessage.create({
      data: {
        workspaceId: access.workspace.id,
        authorId: session.user.id,
        content: parsed.data.content,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, name: true, image: true } },
      },
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Unable to post to team coding discussion:", error);
    return NextResponse.json({ error: "Unable to post discussion message." }, { status: 500 });
  }
}
