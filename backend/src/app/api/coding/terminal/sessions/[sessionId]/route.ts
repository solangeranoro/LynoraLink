import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { resolveCodingWorkspaceForRequest } from "@/lib/coding-workspaces";
import {
  resizeTerminalSession,
  stopTerminalSession,
  waitForTerminalSession,
  writeTerminalInput,
} from "@/lib/coding-terminal-sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("input"), data: z.string().max(64_000) }),
  z.object({
    action: z.literal("resize"),
    cols: z.number().int().min(20).max(300),
    rows: z.number().int().min(5).max(100),
  }),
]);

const invalidRequest = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return invalidRequest("UNAUTHORIZED", 401);
  const access = await resolveCodingWorkspaceForRequest(userId, request);
  if (!access) return invalidRequest("TEAM_ACCESS_REQUIRED", 403);
  const { sessionId } = await params;
  const parsedCursor = Number(new URL(request.url).searchParams.get("cursor") ?? "0");
  if (!Number.isSafeInteger(parsedCursor) || parsedCursor < 0) {
    return invalidRequest("Invalid terminal output cursor.");
  }
  const terminal = await waitForTerminalSession(sessionId, userId, parsedCursor, access.workspace.id);
  return terminal
    ? NextResponse.json(terminal)
    : invalidRequest("Terminal session not found.", 404);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return invalidRequest("UNAUTHORIZED", 401);
  const access = await resolveCodingWorkspaceForRequest(userId, request);
  if (!access) return invalidRequest("TEAM_ACCESS_REQUIRED", 403);
  if (access.role === "OBSERVER") return invalidRequest("Workspace is read-only for observers.", 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest("INVALID_JSON");
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return invalidRequest(parsed.error.issues[0]?.message ?? "Invalid terminal action.");
  }

  const { sessionId } = await params;
  const accepted = parsed.data.action === "input"
    ? writeTerminalInput(sessionId, userId, parsed.data.data, access.workspace.id)
    : resizeTerminalSession(sessionId, userId, parsed.data.cols, parsed.data.rows, access.workspace.id);
  return accepted
    ? NextResponse.json({ accepted: true })
    : invalidRequest("Terminal session is closed or unavailable.", 409);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return invalidRequest("UNAUTHORIZED", 401);
  const access = await resolveCodingWorkspaceForRequest(userId, request);
  if (!access) return invalidRequest("TEAM_ACCESS_REQUIRED", 403);
  if (access.role !== "LEADER") return invalidRequest("Only team leaders can stop the shared terminal.", 403);
  const { sessionId } = await params;
  return stopTerminalSession(sessionId, userId, access.workspace.id)
    ? NextResponse.json({ stopped: true })
    : invalidRequest("Terminal session not found.", 404);
}
