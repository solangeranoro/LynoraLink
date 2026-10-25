import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveCodingWorkspaceForRequest } from "@/lib/coding-workspaces";

export const dynamic = "force-dynamic";

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id: teamId } = await props.params;
  const filePath = new URL(request.url).searchParams.get("filePath");
  if (
    !filePath || filePath.length > 512 || filePath.startsWith("/") || filePath.includes("\\") ||
    filePath.split("/").some((part) => !part || part === "." || part === "..")
  ) return NextResponse.json({ error: "Invalid file path." }, { status: 400 });

  try {
    const access = await resolveCodingWorkspaceForRequest(
      session.user.id,
      new Request(request.url, { headers: { "x-lynora-coding-team": teamId } }),
    );
    if (!access) return NextResponse.json({ error: "TEAM_ACCESS_REQUIRED" }, { status: 403 });
    const file = await prisma.codingFile.findUnique({
      where: { workspaceId_path: { workspaceId: access.workspace.id, path: filePath } },
      select: { id: true, isDirectory: true },
    });
    if (!file || file.isDirectory) return NextResponse.json({ error: "FILE_NOT_FOUND" }, { status: 404 });
    const versions = await prisma.codingFileVersion.findMany({
      where: { fileId: file.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ versions });
  } catch (error) {
    console.error("Unable to load coding workspace history:", error);
    return NextResponse.json({ error: "Unable to load file history." }, { status: 500 });
  }
}
