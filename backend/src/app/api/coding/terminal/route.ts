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
import { hasTerminalWorkspaceSession } from "@/lib/coding-terminal-sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILES = 10_000;
const MAX_FILE_SIZE = 2_000_000;
const MAX_WORKSPACE_SIZE = 2_000_000_000;
const MAX_COMMAND_OUTPUT = 512_000;
const COMMAND_TIMEOUT_MS = 120_000;
const IGNORED_DIRECTORIES = new Set([
  ".git", ".next", ".turbo", ".vercel", ".cache", "node_modules",
  "dist", "build", "coverage",
]);

const requestSchema = z.object({
  command: z.string().trim().min(1).max(4_000),
  cwd: z.string().min(1).max(512).default("/workspace"),
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

function containerArgs(
  volume: string,
  image: string,
  network: "none" | "bridge",
  cwd = "/workspace",
  ...command: string[]
): string[] {
  return [
    "run", "--rm", "--name", `lynoracoding-${randomUUID()}`, `--network=${network}`,
    "--memory=512m", "--cpus=1", "--pids-limit=128",
    "--ulimit", "nofile=256:256", "--ulimit", "fsize=104857600:104857600",
    "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges",
    `--workdir=${cwd}`,
    "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m",
    "--tmpfs", "/home/node:rw,nosuid,nodev,size=16m,uid=1000,gid=1000",
    "--user=1000:1000", "--env=HOME=/home/terminal",
    "--volume", `${volume}:/workspace`,
    image,
    ...command,
  ];
}

function runDocker(
  args: string[],
  input?: string,
  maxOutput = MAX_COMMAND_OUTPUT,
  timeoutMs = COMMAND_TIMEOUT_MS,
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
    let outputLimitReached = false;
    let timedOut = false;
    const containerName = args[args.indexOf("--name") + 1];
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
      if (containerName) {
        const stopper = spawn(dockerCommand, ["kill", containerName], {
          stdio: "ignore",
          windowsHide: true,
          env: { ...process.env, PATH: getCodingTerminalDockerPath() },
        });
        stopper.on("error", (error) => console.error("Unable to stop a timed-out terminal container:", error));
      }
    }, timeoutMs);
    const collect = (target: "stdout" | "stderr", chunk: Buffer) => {
      const remaining = Math.max(0, maxOutput - collected);
      const text = chunk.toString("utf8");
      const accepted = Buffer.from(text, "utf8").subarray(0, remaining).toString("utf8");
      collected += Buffer.byteLength(accepted, "utf8");
      if (target === "stdout") stdout += accepted;
      else stderr += accepted;
      if (accepted.length < text.length) {
        outputLimitReached = true;
        child.kill();
        if (containerName) {
          const stopper = spawn(dockerCommand, ["kill", containerName], {
            stdio: "ignore",
            windowsHide: true,
            env: { ...process.env, PATH: getCodingTerminalDockerPath() },
          });
          stopper.on("error", (error) => console.error("Unable to stop an over-limit terminal container:", error));
        }
      }
    };
    child.stdout.on("data", (chunk: Buffer) => collect("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => collect("stderr", chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr: outputLimitReached
          ? `${stderr}\n[Output truncated at ${maxOutput} bytes.]`
          : stderr,
        exitCode: timedOut ? 124 : code ?? 1,
      });
    });
    child.stdin.end(input);
  });
}

function safeWorkingDirectory(requestedCwd: string): string | null {
  const cwd = path.posix.normalize(requestedCwd);
  return cwd === "/workspace" || cwd.startsWith("/workspace/")
    ? cwd
    : null;
}

function isIgnoredPath(filePath: string): boolean {
  return filePath.split("/").some((part) => IGNORED_DIRECTORIES.has(part.toLowerCase()));
}

async function updateWorkspaceFiles(workspaceId: string, entries: WorkspaceEntry[]) {
  const existing = await prisma.codingFile.findMany({
    where: { workspaceId },
    select: { path: true, isDirectory: true, content: true },
  });
  const existingByPath = new Map(existing.map((entry) => [entry.path, entry]));
  const nextByPath = new Map(entries.map((entry) => [entry.path, entry]));
  const removedPaths = existing
    .filter((entry) => !nextByPath.has(entry.path))
    .map((entry) => entry.path);
  const added = entries.filter((entry) => !existingByPath.has(entry.path));
  const changed = entries.filter((entry) => {
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
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return invalidRequest(parsed.error.issues[0]?.message ?? "Invalid terminal command.");
  }

  const cwd = safeWorkingDirectory(parsed.data.cwd);
  if (!cwd) return invalidRequest("The terminal cannot leave the project workspace.");
  const network = process.env.LYNORACODING_TERMINAL_NETWORK || "none";
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
    if (hasTerminalWorkspaceSession(workspaceWithFiles.id)) {
      return invalidRequest("Close active terminal sessions before running a one-shot command.", 409);
    }
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

    const cdMatch = /^cd(?:\s+(.+))?$/.exec(parsed.data.command);
    if (cdMatch) {
      const target = (cdMatch[1] ?? "/workspace").replace(/^(['"])(.*)\1$/, "$2");
      const nextCwd = safeWorkingDirectory(path.posix.resolve(cwd, target));
      if (!nextCwd) {
        return NextResponse.json({ output: "cd: path is outside the project workspace.", cwd, exitCode: 1, network });
      }
      if (!directories.has(nextCwd)) {
        return NextResponse.json({ output: `cd: ${target}: no such directory`, cwd, exitCode: 1, network });
      }
      return NextResponse.json({ output: "", cwd: nextCwd, exitCode: 0, network });
    }

    const workspaceEntries: WorkspaceEntry[] = workspaceWithFiles.files
      .filter((file) => !isIgnoredPath(file.path))
      .map((file) => ({
        path: file.path,
        isDirectory: file.isDirectory,
        content: file.isDirectory ? "" : file.content,
      }));
    const totalContentBytes = workspaceEntries.reduce(
      (total, entry) => total + Buffer.byteLength(entry.content, "utf8"),
      0,
    );
    if (workspaceEntries.length > MAX_FILES || totalContentBytes > MAX_WORKSPACE_SIZE) {
      return invalidRequest("The workspace exceeds the terminal import limits.", 413);
    }

    const workspaceKey = createHash("sha256").update(workspace.id).digest("hex").slice(0, 32);
    const volume = `lynoracoding-${workspaceKey}`;
    const image = process.env.LYNORACODING_TERMINAL_IMAGE || "lynoracoding-terminal:latest";
    const dockerPrefix = containerArgs(volume, image, network);

    let sync: ProcessResult;
    try {
      sync = await runDocker(
        [...dockerPrefix, "node", "-e", syncWorkspaceScript],
        JSON.stringify(workspaceEntries),
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
      return invalidRequest(
        sync.stderr.trim() || "Could not synchronize the project into its isolated terminal.",
        503,
      );
    }

    const command = await runDocker([
      ...containerArgs(volume, image, network, cwd),
      "sh", "-lc", parsed.data.command,
    ]);
    const snapshot = await runDocker(
      [...dockerPrefix, "node", "-e", snapshotWorkspaceScript],
      undefined,
      120_000_000,
    );
    if (snapshot.exitCode !== 0) {
      return invalidRequest(
        snapshot.stderr.trim() || "Could not synchronize terminal changes back to the project.",
        500,
      );
    }

    let changedFiles: WorkspaceEntry[];
    try {
      changedFiles = JSON.parse(snapshot.stdout) as WorkspaceEntry[];
    } catch (error) {
      console.error("Unable to parse the coding terminal workspace snapshot:", error);
      return invalidRequest("The terminal returned an invalid workspace snapshot.", 500);
    }
    await updateWorkspaceFiles(workspace.id, changedFiles);

    const output = [command.stdout.trimEnd(), command.stderr.trimEnd()]
      .filter(Boolean)
      .join("\n");
    return NextResponse.json({
      output,
      cwd,
      exitCode: command.exitCode,
      timedOut: command.exitCode === 124,
    });
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
    console.error("Unable to run an isolated LynoraCoding terminal command:", error);
    return invalidRequest(
      "Unable to run the command in the isolated project terminal. Verify that Docker is running and the terminal image is available.",
      503,
    );
  }
}
