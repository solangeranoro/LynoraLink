import { auth } from "@/lib/auth";
import { hasVerifiedPremiumAccess } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { resolveCodingWorkspaceForRequest } from "@/lib/coding-workspaces";
import { hasTerminalWorkspaceSession } from "@/lib/coding-terminal-sessions";
import { recordLynoAIActivity } from "@/lib/lynoai-quota";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const applySchema = z.object({
  changes: z.array(z.object({
    path: z.string().min(1).max(512),
    content: z.string().max(2_000_000),
    expectedUpdatedAt: z.string().datetime().nullable(),
  })).min(1).max(10),
}).superRefine(({ changes }, context) => {
  const paths = new Set<string>();
  let bytes = 0;
  for (const change of changes) {
    if (!validPath(change.path)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid file path.", path: ["changes"] });
    }
    if (paths.has(change.path)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate file path.", path: ["changes"] });
    }
    paths.add(change.path);
    if (change.content.includes("\0")) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Binary file changes are not supported.", path: ["changes"] });
    }
    bytes += Buffer.byteLength(change.content, "utf8");
  }
  if (bytes > 10_000_000) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Changes exceed the 10 MB limit.", path: ["changes"] });
  }
});

function validPath(path: string) {
  return !path.startsWith("/") && !path.includes("\\") &&
    path.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await hasVerifiedPremiumAccess(userId))) {
    return NextResponse.json({ error: "VERIFICATION_REQUIRED" }, { status: 403 });
  }

  const parsed = applySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid file changes." }, { status: 422 });
  }

  try {
    const access = await resolveCodingWorkspaceForRequest(userId, request);
    if (!access) return NextResponse.json({ error: "TEAM_ACCESS_REQUIRED" }, { status: 403 });
    if (access.role === "OBSERVER") {
      return NextResponse.json({ error: "Workspace is read-only for observers." }, { status: 403 });
    }
    const workspace = access.workspace;
    if (hasTerminalWorkspaceSession(workspace.id)) {
      return NextResponse.json({
        error: "Close active terminal sessions before applying LynoAI file changes.",
      }, { status: 409 });
    }
    await prisma.$transaction(async (transaction) => {
      const changes = parsed.data.changes;
      const changedPaths = new Set(changes.map((change) => change.path));
      const missingDirectories = new Set<string>();
      const parentPaths = changes.flatMap(({ path }) => {
        const parts = path.split("/");
        return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join("/"));
      });
      const allPaths = [...new Set([...changedPaths, ...parentPaths])];
      const existing = await transaction.codingFile.findMany({
        where: { workspaceId: workspace.id, path: { in: allPaths } },
      });
      const existingByPath = new Map(existing.map((file) => [file.path, file]));

      for (const change of changes) {
        const current = existingByPath.get(change.path);
        if (change.expectedUpdatedAt === null) {
          if (current) throw new Error("LYNOAI_FILE_CONFLICT");
        } else if (
          !current ||
          current.isDirectory ||
          current.updatedAt.toISOString() !== change.expectedUpdatedAt
        ) {
          throw new Error("LYNOAI_FILE_CONFLICT");
        }

        const parts = change.path.split("/");
        for (let index = 1; index < parts.length; index += 1) {
          const parentPath = parts.slice(0, index).join("/");
          const parent = existingByPath.get(parentPath);
          if (parent && !parent.isDirectory) throw new Error("LYNOAI_PATH_CONFLICT");
          if (!parent) missingDirectories.add(parentPath);
        }
      }

      const directoriesToCreate = [...missingDirectories].map((path) => ({
        workspaceId: workspace.id,
        path,
        isDirectory: true,
        content: "",
      }));
      if (directoriesToCreate.length) {
        await transaction.codingFile.createMany({ data: directoriesToCreate });
      }

      for (const change of changes) {
        const current = existingByPath.get(change.path);
        if (current) {
          const updated = await transaction.codingFile.updateMany({
            where: {
              id: current.id,
              updatedAt: new Date(change.expectedUpdatedAt!),
            },
            data: { content: change.content },
          });
          if (updated.count !== 1) throw new Error("LYNOAI_FILE_CONFLICT");
        } else {
          await transaction.codingFile.create({
            data: {
              workspaceId: workspace.id,
              path: change.path,
              isDirectory: false,
              content: change.content,
            },
          });
        }
      }
    });
    let activityTracked = true;
    try {
      await recordLynoAIActivity(userId, "lynoracoding", "code_changes_applied");
    } catch (error) {
      activityTracked = false;
      console.error("Unable to record LynoraCoding apply analytics:", error);
    }
    return NextResponse.json({ applied: parsed.data.changes.length, activityTracked });
  } catch (error) {
    if (error instanceof Error && error.message === "LYNOAI_FILE_CONFLICT") {
      return NextResponse.json({
        error: "One or more files changed since LynoAI prepared this proposal. Ask LynoAI to review the latest workspace and try again.",
      }, { status: 409 });
    }
    if (error instanceof Error && error.message === "LYNOAI_PATH_CONFLICT") {
      return NextResponse.json({ error: "A parent path is a file, not a folder." }, { status: 409 });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "A file or folder already exists at one of the proposed paths." }, { status: 409 });
    }
    console.error("Unable to apply LynoAI coding changes:", error);
    return NextResponse.json({ error: "Unable to apply the proposed changes." }, { status: 500 });
  }
}
