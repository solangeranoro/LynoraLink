import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getCodingTerminalDockerCommand,
  getCodingTerminalDockerPath,
  isCodingTerminalDockerUnavailable,
} from "@/lib/coding-terminal-docker";
import { prisma } from "@/lib/prisma";
import { resolveCodingWorkspaceForRequest } from "@/lib/coding-workspaces";
import {
  createTerminalSession,
  getWorkspaceTerminalSession,
  hasOtherTerminalWorkspaceSession,
  hasTerminalWorkspaceSession,
  withTerminalWorkspaceLock,
} from "@/lib/coding-terminal-sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILES = 10_000;
const MAX_FILE_SIZE = 2_000_000;
const MAX_WORKSPACE_SIZE = 2_000_000_000;
const FORWARDED_PORTS = [3000, 3001, 4000, 4173, 4200, 4321, 5000, 5173, 8000, 8080, 8081, 8888, 9000];
const IGNORED_DIRECTORIES = new Set([
  ".git", ".next", ".turbo", ".vercel", ".cache", "node_modules",
  "dist", "build", "coverage",
]);

const startSchema = z.object({
  cwd: z.string().min(1).max(512).default("/workspace"),
  cols: z.number().int().min(20).max(300).default(80),
  rows: z.number().int().min(5).max(100).default(24),
});

type WorkspaceEntry = {
  path: string;
  isDirectory: boolean;
  content: string;
};

type ProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

const invalidRequest = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

const syncWorkspaceScript = `
const fs = require("node:fs/promises");
const path = require("node:path");
const ignored = new Set(${JSON.stringify([...IGNORED_DIRECTORIES])});
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", async () => {
  try {
    const entries = JSON.parse(input);
    for (const item of await fs.readdir("/workspace", { withFileTypes: true })) {
      if (!ignored.has(item.name.toLowerCase())) {
        await fs.rm(path.join("/workspace", item.name), { recursive: true, force: true });
      }
    }
    for (const entry of entries) {
      const segments = entry.path.split("/");
      if (segments.some((part) => !part || part === "." || part === ".." || part.includes("\\\\"))) {
        throw new Error("Invalid workspace file path.");
      }
      if (segments.some((part) => ignored.has(part.toLowerCase()))) continue;
      const target = path.join("/workspace", ...segments);
      if (!target.startsWith("/workspace/")) throw new Error("Invalid workspace file path.");
      if (entry.isDirectory) await fs.mkdir(target, { recursive: true });
      else {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, entry.content, { encoding: "utf8", mode: 0o600 });
      }
    }
  } catch (error) {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
});
`;

const snapshotWorkspaceScript = `
const fs = require("node:fs/promises");
const path = require("node:path");
const { TextDecoder } = require("node:util");
const ignored = new Set(${JSON.stringify([...IGNORED_DIRECTORIES])});
const decoder = new TextDecoder("utf-8", { fatal: true });
const maxFiles = ${MAX_FILES};
const maxFileSize = ${MAX_FILE_SIZE};
const maxWorkspaceSize = ${MAX_WORKSPACE_SIZE};
(async () => {
  const result = [];
  let totalSize = 0;
  async function walk(directory, parent = "") {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name.toLowerCase()) || entry.isSymbolicLink()) continue;
      const relative = parent ? parent + "/" + entry.name : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        result.push({ path: relative, isDirectory: true, content: "" });
        if (result.length > maxFiles) throw new Error("Project has too many workspace entries.");
        await walk(absolute, relative);
      } else if (entry.isFile()) {
        const stat = await fs.stat(absolute);
        if (stat.size > maxFileSize) continue;
        const buffer = await fs.readFile(absolute);
        let content;
        try { content = decoder.decode(buffer); } catch { continue; }
        if (content.includes("\\0")) continue;
        totalSize += buffer.length;
        if (totalSize > maxWorkspaceSize) throw new Error("Project exceeds the 2,000 MB workspace limit.");
        result.push({ path: relative, isDirectory: false, content });
        if (result.length > maxFiles) throw new Error("Project has too many workspace entries.");
      }
    }
  }
  await walk("/workspace");
  process.stdout.write(JSON.stringify(result));
})().catch((error) => {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
`;

function isIgnoredPath(filePath: string): boolean {
  return filePath.split("/").some((part) => IGNORED_DIRECTORIES.has(part.toLowerCase()));
}

function safeWorkingDirectory(requestedCwd: string): string | null {
  if (requestedCwd.includes("\\") || requestedCwd.includes("\0")) return null;
  const cwd = path.posix.normalize(requestedCwd);
  return cwd === "/workspace" || cwd.startsWith("/workspace/") ? cwd : null;
}

function dockerHelperArgs(
  volume: string,
  image: string,
  network: "none" | "bridge",
  ...command: string[]
): string[] {
  return [
    "run", "--rm", "--interactive", `--network=${network}`,
    "--memory=512m", "--cpus=1", "--pids-limit=128",
    "--ulimit", "nofile=256:256", "--ulimit", "fsize=104857600:104857600",
    "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges",
    "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m",
    "--tmpfs", "/home/node:rw,nosuid,nodev,size=16m,uid=1000,gid=1000",
    "--user=1000:1000", "--env=HOME=/home/node",
    "--volume", `${volume}:/workspace`,
    image,
    ...command,
  ];
}

function runDocker(
  args: string[],
  input?: string,
  maxOutput = 120_000_000,
  timeoutMs = 120_000,
): Promise<ProcessResult> {
  const dockerCommand = getCodingTerminalDockerCommand();
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(dockerCommand, args, {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env: { ...process.env, PATH: getCodingTerminalDockerPath() },
      });
    } catch (error) {
      reject(error);
      return;
    }
    let stdout = "";
    let stderr = "";
    let collected = 0;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    const collect = (target: "stdout" | "stderr", chunk: Buffer) => {
      const remaining = Math.max(0, maxOutput - collected);
      const text = chunk.toString("utf8");
      const accepted = Buffer.from(text, "utf8").subarray(0, remaining).toString("utf8");
      collected += Buffer.byteLength(accepted, "utf8");
      if (target === "stdout") stdout += accepted;
      else stderr += accepted;
      if (accepted.length < text.length) child.kill();
    };
    child.stdout.on("data", (chunk: Buffer) => collect("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => collect("stderr", chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EPIPE") return;
      clearTimeout(timeout);
      child.kill();
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr: timedOut ? `${stderr}\nDocker operation timed out.` : stderr,
        exitCode: timedOut ? 124 : code ?? 1,
      });
    });
    child.stdin.end(input);
  });
}

async function updateWorkspaceFiles(workspaceId: string, entries: WorkspaceEntry[]) {
  const existing = await prisma.codingFile.findMany({
    where: { workspaceId },
    select: { path: true, isDirectory: true, content: true },
  });
  const preserved = existing.filter((entry) => isIgnoredPath(entry.path));
  const nextEntries = [...entries, ...preserved];
  const existingByPath = new Map(existing.map((entry) => [entry.path, entry]));
  const nextByPath = new Map(nextEntries.map((entry) => [entry.path, entry]));
  const removedPaths = existing.filter((entry) => !nextByPath.has(entry.path)).map((entry) => entry.path);
  const added = nextEntries.filter((entry) => !existingByPath.has(entry.path));
  const changed = nextEntries.filter((entry) => {
    const previous = existingByPath.get(entry.path);
    return previous && (
      previous.isDirectory !== entry.isDirectory ||
      previous.content !== entry.content
    );
  });

  await prisma.$transaction(async (transaction) => {
    if (removedPaths.length) {
      await transaction.codingFile.deleteMany({
        where: { workspaceId, path: { in: removedPaths } },
      });
    }
    if (added.length) {
      await transaction.codingFile.createMany({
        data: added.map((entry) => ({ workspaceId, ...entry })),
      });
    }
    for (let index = 0; index < changed.length; index += 100) {
      await Promise.all(changed.slice(index, index + 100).map((entry) =>
        transaction.codingFile.update({
          where: { workspaceId_path: { workspaceId, path: entry.path } },
          data: { isDirectory: entry.isDirectory, content: entry.content },
        }),
      ));
    }
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return invalidRequest("UNAUTHORIZED", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest("INVALID_JSON");
  }
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) return invalidRequest(parsed.error.issues[0]?.message ?? "Invalid terminal settings.");
  const cwd = safeWorkingDirectory(parsed.data.cwd);
  if (!cwd) return invalidRequest("The terminal cannot leave the project workspace.");

  const network = process.env.LYNORACODING_TERMINAL_NETWORK || "bridge";
  if (network !== "none" && network !== "bridge") {
    return invalidRequest("LYNORACODING_TERMINAL_NETWORK must be set to none or bridge.", 503);
  }

  try {
    const access = await resolveCodingWorkspaceForRequest(session.user.id, request);
    if (!access) return invalidRequest("TEAM_ACCESS_REQUIRED", 403);
    if (access.role === "OBSERVER") return invalidRequest("Workspace is read-only for observers.", 403);
    const workspace = access.workspace;
    const workspaceWithFiles = await prisma.codingWorkspace.findUniqueOrThrow({
      where: { id: workspace.id },
      include: { files: { orderBy: { path: "asc" } } },
    });
    const directories = new Set(["/workspace"]);
    for (const file of workspaceWithFiles.files) {
      if (isIgnoredPath(file.path)) continue;
      const parts = file.path.split("/");
      for (let index = 1; index < parts.length; index += 1) {
        directories.add(`/workspace/${parts.slice(0, index).join("/")}`);
      }
      if (file.isDirectory) directories.add(`/workspace/${file.path}`);
    }
    if (!directories.has(cwd)) {
      return invalidRequest("The terminal working directory does not exist in this project.", 400);
    }

    const entries: WorkspaceEntry[] = workspaceWithFiles.files
      .filter((file) => !isIgnoredPath(file.path))
      .map((file) => ({
        path: file.path,
        isDirectory: file.isDirectory,
        content: file.isDirectory ? "" : file.content,
      }));
    const totalContentBytes = entries.reduce(
      (total, entry) => total + Buffer.byteLength(entry.content, "utf8"),
      0,
    );
    if (entries.length > MAX_FILES || totalContentBytes > MAX_WORKSPACE_SIZE) {
      return invalidRequest("The workspace exceeds the terminal import limits.", 413);
    }

    const workspaceKey = createHash("sha256").update(workspace.id).digest("hex").slice(0, 32);
    const volume = `lynoracoding-${workspaceKey}`;
    const image = process.env.LYNORACODING_TERMINAL_IMAGE || "lynoracoding-terminal:latest";
    const dockerCommand = getCodingTerminalDockerCommand();
    const containerName = `lynoracoding-${randomUUID()}`;

    const terminal = await withTerminalWorkspaceLock(workspace.id, async () => {
      const existingSession = getWorkspaceTerminalSession(workspace.id);
      if (existingSession) return existingSession;
      if (!hasTerminalWorkspaceSession(workspace.id)) {
        let sync: ProcessResult;
        try {
          sync = await runDocker(
            dockerHelperArgs(volume, image, "none", "node", "-e", syncWorkspaceScript),
            JSON.stringify(entries),
            1_000_000,
          );
        } catch (error) {
          if (isCodingTerminalDockerUnavailable(error)) {
            throw new Error(
              "The real isolated terminal is unavailable. Start Docker and build the lynoracoding-terminal:latest image.",
            );
          }
          throw error;
        }
        if (sync.exitCode !== 0) {
          if (isCodingTerminalDockerUnavailable(sync.stderr)) {
            throw new Error(
              "The real isolated terminal is unavailable. Start Docker and build the lynoracoding-terminal:latest image.",
            );
          }
          throw new Error(sync.stderr.trim() || "Could not synchronize the project into its terminal.");
        }
      }

      const args = [
        "run", "--name", containerName, "--interactive", "--tty", "--init",
        `--network=${network}`, "--memory=512m", "--cpus=1", "--pids-limit=128",
        ...(network === "bridge" ? FORWARDED_PORTS.flatMap((port) => ["--publish", `127.0.0.1::${port}`]) : []),
        "--ulimit", "nofile=256:256", "--ulimit", "fsize=104857600:104857600",
        "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges",
        `--workdir=${cwd}`,
        "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m",
        "--tmpfs", "/home/node:rw,nosuid,nodev,size=16m,uid=1000,gid=1000",
        "--user=1000:1000", "--env=HOME=/home/node", "--env=TERM=xterm-256color",
        "--env=COLORTERM=truecolor",
        `--env=LYNORACODING_PROJECT_NAME=${workspace.name}`,
        "--env=PS1=\\[\\e]777;lynora-ready\\a\\]\\[\\e[32m\\]\\u@${LYNORACODING_PROJECT_NAME} \\[\\e[34m\\]\\w\\[\\e[0m\\]\\$ ",
        "--volume", `${volume}:/workspace`,
        image, "bash", "--noprofile", "--norc", "-i",
      ];

      return createTerminalSession({
        userId: session.user.id,
        workspaceId: workspace.id,
        containerName,
        dockerCommand,
        dockerArgs: args,
        cwd,
        cols: parsed.data.cols,
        rows: parsed.data.rows,
        finalize: async (sessionId) => withTerminalWorkspaceLock(workspace.id, async () => {
          let synchronizationError: Error | null = null;
          if (!hasOtherTerminalWorkspaceSession(workspace.id, sessionId)) {
            const snapshot = await runDocker(
              dockerHelperArgs(volume, image, "none", "node", "-e", snapshotWorkspaceScript),
            );
            if (snapshot.exitCode !== 0) {
              synchronizationError = new Error(
                snapshot.stderr.trim() || "Could not synchronize terminal changes back to the project.",
              );
            } else {
              try {
                const changedFiles = JSON.parse(snapshot.stdout) as WorkspaceEntry[];
                await updateWorkspaceFiles(workspace.id, changedFiles);
              } catch (error) {
                synchronizationError = error instanceof Error
                  ? error
                  : new Error("The terminal returned an invalid workspace snapshot.");
              }
            }
          }

          const removed = await runDocker(["rm", "--force", containerName], undefined, 10_000, 30_000);
          if (removed.exitCode !== 0 && !removed.stderr.includes("No such container")) {
            console.error("Unable to remove a stopped coding terminal container:", removed.stderr);
          }
          if (synchronizationError) throw synchronizationError;
        }),
      });
    });

    return NextResponse.json(terminal, { status: 201 });
  } catch (error) {
    const isMissingDocker = error instanceof Error && "code" in error && error.code === "ENOENT";
    if (isMissingDocker) {
      return invalidRequest(
        "The real isolated terminal is unavailable. Install or start Docker, build the lynoracoding-terminal:latest image, and make Docker accessible to the backend.",
        503,
      );
    }
    if (isCodingTerminalDockerUnavailable(error)) {
      return invalidRequest(
        "The real isolated terminal is unavailable. Start Docker and build the lynoracoding-terminal:latest image.",
        503,
      );
    }
    console.error("Unable to start an interactive LynoraCoding terminal:", error);
    return invalidRequest(
      error instanceof Error && error.message.includes("maximum of four")
        ? error.message
        : error instanceof Error && error.message
          ? error.message
          : "Unable to start the isolated project terminal.",
      503,
    );
  }
}
