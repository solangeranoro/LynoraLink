import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasTerminalWorkspaceSession } from "@/lib/coding-terminal-sessions";
import { resolveCodingWorkspaceForRequest } from "@/lib/coding-workspaces";

export const dynamic = "force-dynamic";

const MAX_WORKSPACE_FILES = 5_000;
const MAX_WORKSPACE_ENTRIES = 10_000;
const MAX_WORKSPACE_CONTENT_BYTES = 2_000_000_000;
const INVALID_WORKSPACE_WINDOW_ID = "A valid coding workspace window ID is required.";

const createSchema = z.object({
  parentPath: z.string().max(512).default(""),
  name: z.string().min(1).max(128),
  isDirectory: z.boolean().default(false),
});

const importSchema = z.object({
  files: z.array(z.object({
    path: z.string().min(1).max(512),
    isDirectory: z.boolean(),
    content: z.string().max(2_000_000),
  })).min(1).max(MAX_WORKSPACE_FILES),
}).superRefine(({ files }, context) => {
  const paths = new Set<string>();
  const directories = new Set<string>();
  let contentBytes = 0;
  for (const file of files) {
    if (!validPath(file.path)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid workspace path.", path: ["files"] });
      continue;
    }
    if (paths.has(file.path)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate workspace path.", path: ["files"] });
    }
    paths.add(file.path);
    if (file.isDirectory) {
      if (file.content) context.addIssue({ code: z.ZodIssueCode.custom, message: "Directories cannot contain file content.", path: ["files"] });
      directories.add(file.path);
    } else {
      contentBytes += Buffer.byteLength(file.content, "utf8");
    }
  }
  if (contentBytes > MAX_WORKSPACE_CONTENT_BYTES) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Workspace import exceeds 2,000 MB.", path: ["files"] });
  }
});

const saveSchema = z.object({
  path: z.string().min(1).max(512),
  content: z.string().max(2_000_000),
});

const pathSchema = z.object({ path: z.string().min(1).max(512) });
const settingsSchema = z.object({
  settings: z.object({
    theme: z.enum(["light", "dark"]),
    fontFamily: z.enum(["monospace", "JetBrains Mono", "Consolas", "Fira Code"]),
    fontSize: z.number().int().min(10).max(32),
    minimap: z.boolean(),
    lineNumbers: z.boolean(),
    wordWrap: z.boolean(),
    tabSize: z.union([z.literal(2), z.literal(4), z.literal(8)]),
    shortcuts: z.object({
      save: z.string().min(1).max(32),
      commandPalette: z.string().min(1).max(32),
      toggleSidebar: z.string().min(1).max(32),
      toggleTerminal: z.string().min(1).max(32),
    }),
  }),
});
const replaceWorkspaceSchema = z.object({
  projectName: z.string().trim().min(1).max(128).optional(),
  files: z.array(z.object({
    path: z.string().min(1).max(512),
    isDirectory: z.boolean(),
    content: z.string().max(2_000_000),
  })).max(MAX_WORKSPACE_ENTRIES),
}).superRefine(({ files }, context) => {
  const paths = new Set<string>();
  const directories = new Set<string>();
  let contentBytes = 0;
  for (const file of [...files].sort((left, right) => left.path.split("/").length - right.path.split("/").length)) {
    if (!validPath(file.path)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid workspace path.", path: ["files"] });
      continue;
    }
    if (paths.has(file.path)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate workspace path.", path: ["files"] });
    }
    paths.add(file.path);
    const parentPath = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";
    if (parentPath && !directories.has(parentPath)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Workspace parent folder is missing.", path: ["files"] });
    }
    if (file.isDirectory) {
      if (file.content) context.addIssue({ code: z.ZodIssueCode.custom, message: "Directories cannot contain file content.", path: ["files"] });
      directories.add(file.path);
    }
    contentBytes += Buffer.byteLength(file.content, "utf8");
  }
  if (contentBytes > MAX_WORKSPACE_CONTENT_BYTES) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Workspace content exceeds 2,000 MB.", path: ["files"] });
  }
});

function validPath(path: string): boolean {
  return !path.startsWith("/") &&
    !path.includes("\\") &&
    path.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

function invalidRequest(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

async function currentWorkspace(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const access = await resolveCodingWorkspaceForRequest(session.user.id, request);
  return access ? { ...access.workspace, codingRole: access.role } : null;
}

export async function GET(request: Request) {
  try {
    const workspace = await currentWorkspace(request);
    if (!workspace) return invalidRequest("UNAUTHORIZED", 401);
    const files = await prisma.codingFile.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { path: "asc" },
    });
    return NextResponse.json({
      workspace: { id: workspace.id, name: workspace.name, role: workspace.codingRole },
      settings: JSON.parse(workspace.settings),
      files,
    });
  } catch (error) {
    if (error instanceof Error && error.message === INVALID_WORKSPACE_WINDOW_ID) {
      return invalidRequest(INVALID_WORKSPACE_WINDOW_ID);
    }
    console.error("Unable to load the coding workspace:", error);
    return invalidRequest("Unable to load the coding workspace.", 500);
  }
}

export async function POST(request: Request) {
  let workspace: Awaited<ReturnType<typeof currentWorkspace>>;
  try {
    workspace = await currentWorkspace(request);
  } catch (error) {
    if (error instanceof Error && error.message === INVALID_WORKSPACE_WINDOW_ID) {
      return invalidRequest(INVALID_WORKSPACE_WINDOW_ID);
    }
    console.error("Unable to resolve the coding workspace:", error);
    return invalidRequest("Unable to access the coding workspace.", 500);
  }
  if (!workspace) return invalidRequest("UNAUTHORIZED", 401);
  if (workspace.codingRole === "OBSERVER") return invalidRequest("Workspace is read-only for observers.", 403);
  if (hasTerminalWorkspaceSession(workspace.id)) {
    return invalidRequest("Close active terminal sessions before modifying workspace files.", 409);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest("INVALID_JSON");
  }
  if (typeof body === "object" && body !== null && "files" in body) {
    const parsedImport = importSchema.safeParse(body);
    if (!parsedImport.success) {
      return NextResponse.json({
        error: parsedImport.error.issues[0]?.message ?? "Invalid file import.",
        issues: parsedImport.error.flatten().fieldErrors,
      }, { status: 422 });
    }
    try {
      const importedFiles = parsedImport.data.files;
      const paths = importedFiles.map((file) => file.path);
      const parentPaths = importedFiles.flatMap((file) => {
        const parts = file.path.split("/");
        return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join("/"));
      });
      const allPaths = [...new Set([...paths, ...parentPaths])];
      const createdCount = await prisma.$transaction(async (transaction) => {
        const existingFiles = await transaction.codingFile.findMany({
          where: { workspaceId: workspace.id, path: { in: allPaths } },
          select: { path: true, isDirectory: true },
        });
        const existingByPath = new Map(existingFiles.map((file) => [file.path, file]));
        const importedByPath = new Map(importedFiles.map((file) => [file.path, file]));

        for (const file of importedFiles) {
          const existing = existingByPath.get(file.path);
          if (existing && (!existing.isDirectory || !file.isDirectory)) {
            throw new Error(`An item named "${file.path}" already exists in the workspace.`);
          }
          const parts = file.path.split("/");
          for (let index = 1; index < parts.length; index += 1) {
            const parentPath = parts.slice(0, index).join("/");
            const parent = importedByPath.get(parentPath) ?? existingByPath.get(parentPath);
            if (!parent?.isDirectory) {
              throw new Error(`The parent folder "${parentPath}" is missing from the import and workspace.`);
            }
          }
        }

        const filesToCreate = importedFiles
          .filter((file) => !existingByPath.has(file.path))
          .map((file) => ({
            workspaceId: workspace.id,
            path: file.path,
            isDirectory: file.isDirectory,
            content: file.content,
          }));
        if (filesToCreate.length) {
          await transaction.codingFile.createMany({ data: filesToCreate });
        }
        return filesToCreate.length;
      });
      return NextResponse.json({ imported: createdCount });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        return invalidRequest(error.message, 409);
      }
      if (error instanceof Error && error.message.includes("parent folder")) {
        return invalidRequest(error.message, 400);
      }
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        return invalidRequest("A file or folder in the import already exists in the workspace.", 409);
      }
      console.error("Unable to import files into the coding workspace:", error);
      return invalidRequest("Unable to import files into the coding workspace.", 500);
    }
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { parentPath, name, isDirectory } = parsed.data;
  if (!validPath(name) || name.includes("/") || (parentPath && !validPath(parentPath))) {
    return invalidRequest("File and folder names must be a single safe path segment.");
  }
  const path = parentPath ? `${parentPath}/${name}` : name;

  try {
    if (parentPath) {
      const parent = await prisma.codingFile.findUnique({
        where: { workspaceId_path: { workspaceId: workspace.id, path: parentPath } },
      });
      if (!parent?.isDirectory) return invalidRequest("The selected parent folder does not exist.", 404);
    }
    const file = await prisma.codingFile.create({
      data: { workspaceId: workspace.id, path, isDirectory, content: "" },
      select: { id: true, path: true, isDirectory: true, content: true, updatedAt: true },
    });
    return NextResponse.json({ file }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return invalidRequest("A file or folder with that name already exists.", 409);
    }
    console.error("Unable to create a coding workspace file:", error);
    return invalidRequest("Unable to create the file.", 500);
  }
}

export async function PATCH(request: Request) {
  let workspace: Awaited<ReturnType<typeof currentWorkspace>>;
  try {
    workspace = await currentWorkspace(request);
  } catch (error) {
    if (error instanceof Error && error.message === INVALID_WORKSPACE_WINDOW_ID) {
      return invalidRequest(INVALID_WORKSPACE_WINDOW_ID);
    }
    console.error("Unable to resolve the coding workspace:", error);
    return invalidRequest("Unable to access the coding workspace.", 500);
  }
  if (!workspace) return invalidRequest("UNAUTHORIZED", 401);
  if (workspace.codingRole === "OBSERVER") return invalidRequest("Workspace is read-only for observers.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest("INVALID_JSON");
  }
  const parsed = saveSchema.safeParse(body);
  const settings = settingsSchema.safeParse(body);
  if (settings.success) {
    try {
      const updatedWorkspace = await prisma.codingWorkspace.update({
        where: { id: workspace.id },
        data: { settings: JSON.stringify(settings.data.settings) },
        select: { settings: true },
      });
      return NextResponse.json({ settings: JSON.parse(updatedWorkspace.settings) });
    } catch (error) {
      console.error("Unable to save coding workspace settings:", error);
      return invalidRequest("Unable to save editor settings.", 500);
    }
  }
  if (hasTerminalWorkspaceSession(workspace.id)) {
    return invalidRequest("Close active terminal sessions before modifying workspace files.", 409);
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  if (!validPath(parsed.data.path)) return invalidRequest("Invalid file path.");

  try {
    const file = await prisma.codingFile.findUnique({
      where: { workspaceId_path: { workspaceId: workspace.id, path: parsed.data.path } },
      select: { id: true, isDirectory: true },
    });
    if (!file || file.isDirectory) return invalidRequest("The file does not exist.", 404);

    const saved = await prisma.codingFile.update({
      where: { id: file.id },
      data: { content: parsed.data.content },
      select: { id: true, path: true, updatedAt: true },
    });
    return NextResponse.json({ file: saved });
  } catch (error) {
    console.error("Unable to save a coding workspace file:", error);
    return invalidRequest("Unable to save the file.", 500);
  }
}

export async function PUT(request: Request) {
  let workspace: Awaited<ReturnType<typeof currentWorkspace>>;
  try {
    workspace = await currentWorkspace(request);
  } catch (error) {
    if (error instanceof Error && error.message === INVALID_WORKSPACE_WINDOW_ID) {
      return invalidRequest(INVALID_WORKSPACE_WINDOW_ID);
    }
    console.error("Unable to resolve the coding workspace:", error);
    return invalidRequest("Unable to access the coding workspace.", 500);
  }
  if (!workspace) return invalidRequest("UNAUTHORIZED", 401);
  if (workspace.codingRole === "OBSERVER") return invalidRequest("Workspace is read-only for observers.", 403);
  if (hasTerminalWorkspaceSession(workspace.id)) {
    return invalidRequest("Close active terminal sessions before replacing workspace files.", 409);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest("INVALID_JSON");
  }
  const parsed = replaceWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  try {
    const files = parsed.data.files.map((file) => ({
      workspaceId: workspace.id,
      path: file.path,
      isDirectory: file.isDirectory,
      content: file.content,
    }));
    await prisma.$transaction(async (transaction) => {
      await transaction.codingFile.deleteMany({ where: { workspaceId: workspace.id } });
      if (files.length) await transaction.codingFile.createMany({ data: files });
      if (parsed.data.projectName) {
        await transaction.codingWorkspace.update({
          where: { id: workspace.id },
          data: { name: parsed.data.projectName },
        });
      }
    });
    return NextResponse.json({ replaced: files.length });
  } catch (error) {
    console.error("Unable to replace coding workspace files:", error);
    return invalidRequest("Unable to replace the coding workspace.", 500);
  }
}

export async function DELETE(request: Request) {
  let workspace: Awaited<ReturnType<typeof currentWorkspace>>;
  try {
    workspace = await currentWorkspace(request);
  } catch (error) {
    if (error instanceof Error && error.message === INVALID_WORKSPACE_WINDOW_ID) {
      return invalidRequest(INVALID_WORKSPACE_WINDOW_ID);
    }
    console.error("Unable to resolve the coding workspace:", error);
    return invalidRequest("Unable to access the coding workspace.", 500);
  }
  if (!workspace) return invalidRequest("UNAUTHORIZED", 401);
  if (workspace.codingRole === "OBSERVER") return invalidRequest("Workspace is read-only for observers.", 403);
  if (hasTerminalWorkspaceSession(workspace.id)) {
    return invalidRequest("Close active terminal sessions before modifying workspace files.", 409);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest("INVALID_JSON");
  }
  const parsed = pathSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  if (!validPath(parsed.data.path)) return invalidRequest("Invalid file path.");

  try {
    const files = await prisma.codingFile.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, path: true },
    });
    const selected = files.filter((file) =>
      file.path === parsed.data.path || file.path.startsWith(`${parsed.data.path}/`),
    );
    if (!selected.length) return invalidRequest("The file or folder does not exist.", 404);
    await prisma.codingFile.deleteMany({
      where: { id: { in: selected.map((file) => file.id) } },
    });
    return NextResponse.json({ deleted: selected.map((file) => file.path) });
  } catch (error) {
    console.error("Unable to delete a coding workspace file:", error);
    return invalidRequest("Unable to delete the file.", 500);
  }
}
