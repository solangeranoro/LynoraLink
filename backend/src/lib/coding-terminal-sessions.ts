import { spawn, type IPty } from "node-pty";
import { randomUUID } from "node:crypto";
import { getCodingTerminalDockerPath } from "@/lib/coding-terminal-docker";
import {
  createSimulatedTerminal,
  type SimulatedWorkspaceEntry,
} from "@/lib/coding-terminal-simulator";

const MAX_BUFFERED_OUTPUT = 1_000_000;
const MAX_INPUT_SIZE = 64_000;
const IDLE_TIMEOUT_MS = 30 * 60 * 1_000;
const EXITED_SESSION_TTL_MS = 10 * 60 * 1_000;
const MAX_SESSIONS_PER_USER = 4;
const DOCKER_CLIENT_ENV_KEYS = new Set([
  "path", "pathext", "systemroot", "windir", "temp", "tmp",
  "home", "userprofile", "homedrive", "homepath", "xdg_runtime_dir",
  "docker_host", "docker_context", "docker_config", "docker_cert_path",
  "docker_tls_verify", "docker_api_version",
]);

type SessionState = {
  id: string;
  userId: string;
  workspaceId: string;
  containerName: string;
  cwd: string;
  process: IPty | null;
  simulator: ReturnType<typeof createSimulatedTerminal> | null;
  mode: "docker" | "simulated";
  output: string;
  outputOffset: number;
  running: boolean;
  finalizing: boolean;
  exitCode: number | null;
  syncError: string | null;
  expires: ReturnType<typeof setTimeout>;
  finalize: (sessionId: string, exitCode: number) => Promise<void>;
  waiters: Set<() => void>;
};

type SessionRegistry = {
  sessions: Map<string, SessionState>;
  workspaceLocks: Map<string, Promise<void>>;
};

const globalRegistry = globalThis as typeof globalThis & {
  __lynoraCodingTerminalRegistry?: SessionRegistry;
};
const registry = globalRegistry.__lynoraCodingTerminalRegistry ??=
  { sessions: new Map(), workspaceLocks: new Map() };

export type TerminalSessionSnapshot = {
  id: string;
  cwd: string;
  mode: "docker" | "simulated";
  architecture: string;
  running: boolean;
  exitCode: number | null;
  syncError: string | null;
  output: string;
  cursor: number;
};

function touch(session: SessionState, duration = IDLE_TIMEOUT_MS) {
  clearTimeout(session.expires);
  session.expires = setTimeout(() => {
    if (session.running) {
      appendOutput(session, "\r\n[Terminal closed after 30 minutes without activity.]\r\n");
      session.process?.kill();
    } else {
      registry.sessions.delete(session.id);
    }
  }, duration);
  session.expires.unref?.();
}

function appendOutput(session: SessionState, text: string) {
  session.output += text;
  if (session.output.length > MAX_BUFFERED_OUTPUT) {
    const removed = session.output.length - MAX_BUFFERED_OUTPUT;
    session.output = session.output.slice(removed);
    session.outputOffset += removed;
  }
  notifyWaiters(session);
}

function notifyWaiters(session: SessionState) {
  for (const wake of session.waiters) wake();
  session.waiters.clear();
}

export async function withTerminalWorkspaceLock<T>(
  workspaceId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = registry.workspaceLocks.get(workspaceId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  registry.workspaceLocks.set(workspaceId, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (registry.workspaceLocks.get(workspaceId) === queued) {
      registry.workspaceLocks.delete(workspaceId);
    }
  }
}

export function hasTerminalWorkspaceSession(workspaceId: string): boolean {
  return [...registry.sessions.values()].some((session) =>
    session.workspaceId === workspaceId && (session.running || session.finalizing),
  );
}

export function hasOtherTerminalWorkspaceSession(workspaceId: string, sessionId: string): boolean {
  return [...registry.sessions.values()].some((session) =>
    session.id !== sessionId &&
    session.workspaceId === workspaceId &&
    (session.running || session.finalizing),
  );
}

export function getWorkspaceTerminalSession(workspaceId: string): TerminalSessionSnapshot | null {
  const session = [...registry.sessions.values()].find((item) =>
    item.workspaceId === workspaceId && item.running && !item.finalizing,
  );
  if (!session) return null;
  const cursor = session.outputOffset + session.output.length;
  return snapshot(session, session.output, cursor);
}

export function createTerminalSession(options: {
  userId: string;
  workspaceId: string;
  containerName: string;
  dockerCommand: string;
  dockerArgs: string[];
  cwd: string;
  cols: number;
  rows: number;
  finalize: (sessionId: string, exitCode: number) => Promise<void>;
}): TerminalSessionSnapshot {
  const userSessions = [...registry.sessions.values()].filter((session) =>
    session.userId === options.userId && (session.running || session.finalizing),
  );
  if (userSessions.length >= MAX_SESSIONS_PER_USER) {
    throw new Error("You have reached the maximum of four active terminal sessions.");
  }

  const id = randomUUID();
  const terminalProcess = spawn(
    options.dockerCommand,
    options.dockerArgs,
    {
      name: "xterm-256color",
      cols: options.cols,
      rows: options.rows,
      cwd: process.cwd(),
      env: Object.fromEntries(
        Object.entries({ ...process.env, PATH: getCodingTerminalDockerPath() }).filter((entry): entry is [string, string] =>
          typeof entry[1] === "string" && DOCKER_CLIENT_ENV_KEYS.has(entry[0].toLowerCase()),
        ),
      ),
    },
  );
  const session: SessionState = {
    id,
    userId: options.userId,
    workspaceId: options.workspaceId,
    containerName: options.containerName,
    cwd: options.cwd,
    process: terminalProcess,
    simulator: null,
    mode: "docker",
    output: "",
    outputOffset: 0,
    running: true,
    finalizing: false,
    exitCode: null,
    syncError: null,
    expires: setTimeout(() => undefined, IDLE_TIMEOUT_MS),
    finalize: options.finalize,
    waiters: new Set(),
  };
  registry.sessions.set(id, session);
  touch(session);

  terminalProcess.onData((data) => {
    appendOutput(session, data);
  });
  terminalProcess.onExit(({ exitCode }) => {
    session.running = false;
    session.finalizing = true;
    session.exitCode = exitCode;
    notifyWaiters(session);
    void session.finalize(session.id, exitCode)
      .catch((error: unknown) => {
        session.syncError = error instanceof Error
          ? error.message
          : "Unable to save terminal changes to the workspace.";
        console.error("Unable to synchronize the coding terminal workspace:", error);
      })
      .finally(() => {
        session.finalizing = false;
        touch(session, EXITED_SESSION_TTL_MS);
        notifyWaiters(session);
      });
  });

  return snapshot(session, "", 0);
}

export function createSimulatedTerminalSession(options: {
  userId: string;
  workspaceId: string;
  cwd: string;
  entries: SimulatedWorkspaceEntry[];
  cols: number;
  rows: number;
}): TerminalSessionSnapshot {
  const userSessions = [...registry.sessions.values()].filter((session) =>
    session.userId === options.userId && (session.running || session.finalizing),
  );
  if (userSessions.length >= MAX_SESSIONS_PER_USER) {
    throw new Error("You have reached the maximum of four active terminal sessions.");
  }

  const id = randomUUID();
  let session: SessionState;
  let initialOutput = "";
  const simulator = createSimulatedTerminal(
    options.cwd,
    options.entries,
    (output) => {
      if (session) appendOutput(session, output);
      else initialOutput += output;
    },
    (cwd) => {
      if (session) session.cwd = cwd;
    },
  );
  session = {
    id,
    userId: options.userId,
    workspaceId: options.workspaceId,
    containerName: "",
    cwd: options.cwd,
    process: null,
    simulator,
    mode: "simulated",
    output: "",
    outputOffset: 0,
    running: true,
    finalizing: false,
    exitCode: null,
    syncError: null,
    expires: setTimeout(() => undefined, IDLE_TIMEOUT_MS),
    finalize: async () => undefined,
    waiters: new Set(),
  };
  registry.sessions.set(id, session);
  touch(session);
  if (initialOutput) appendOutput(session, initialOutput);
  return snapshot(session, "", 0);
}

function snapshot(session: SessionState, output: string, cursor: number): TerminalSessionSnapshot {
  return {
    id: session.id,
    cwd: session.cwd,
    mode: session.mode,
    architecture: process.arch,
    running: session.running || session.finalizing,
    exitCode: session.exitCode,
    syncError: session.syncError,
    output,
    cursor,
  };
}

export function getTerminalSession(
  sessionId: string,
  userId: string,
  cursor: number,
  workspaceId?: string,
): TerminalSessionSnapshot | null {
  const session = registry.sessions.get(sessionId);
  if (!session || (session.userId !== userId && session.workspaceId !== workspaceId)) return null;
  if (session.simulator) session.cwd = session.simulator.cwd;
  touch(session, session.running || session.finalizing ? IDLE_TIMEOUT_MS : EXITED_SESSION_TTL_MS);

  const nextCursor = session.outputOffset + session.output.length;
  const start = Math.max(0, cursor - session.outputOffset);
  const omittedOutput = cursor < session.outputOffset
    ? "[Earlier terminal output was discarded.]\r\n"
    : "";
  return snapshot(session, omittedOutput + session.output.slice(start), nextCursor);
}

export function getTerminalContainerName(sessionId: string, userId: string): string | null {
  const session = registry.sessions.get(sessionId);
  if (!session || session.userId !== userId || (!session.running && !session.finalizing)) return null;
  return session.containerName;
}

export async function waitForTerminalSession(
  sessionId: string,
  userId: string,
  cursor: number,
  workspaceId?: string,
): Promise<TerminalSessionSnapshot | null> {
  const current = getTerminalSession(sessionId, userId, cursor, workspaceId);
  if (!current || current.output || !current.running) return current;
  const session = registry.sessions.get(sessionId);
  if (!session) return null;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      session.waiters.delete(finish);
      resolve();
    };
    const timeout = setTimeout(finish, 5_000);
    session.waiters.add(finish);
    const latest = getTerminalSession(sessionId, userId, cursor, workspaceId);
    if (!latest || latest.output || !latest.running) finish();
  });
  return getTerminalSession(sessionId, userId, cursor, workspaceId);
}

export function writeTerminalInput(
  sessionId: string,
  userId: string,
  data: string,
  workspaceId?: string,
): boolean {
  const session = registry.sessions.get(sessionId);
  if (!session || (session.userId !== userId && session.workspaceId !== workspaceId) ||
    !session.running || data.length > MAX_INPUT_SIZE) {
    return false;
  }
  touch(session);
  if (session.simulator) session.simulator.write(data);
  else session.process?.write(data);
  return true;
}

export function resizeTerminalSession(
  sessionId: string,
  userId: string,
  cols: number,
  rows: number,
  workspaceId?: string,
): boolean {
  const session = registry.sessions.get(sessionId);
  if (!session || (session.userId !== userId && session.workspaceId !== workspaceId) || !session.running) return false;
  touch(session);
  session.process?.resize(cols, rows);
  return true;
}

export function stopTerminalSession(sessionId: string, userId: string, workspaceId?: string): boolean {
  const session = registry.sessions.get(sessionId);
  if (!session || (session.userId !== userId && session.workspaceId !== workspaceId)) return false;
  touch(session, EXITED_SESSION_TTL_MS);
  if (session.running) {
    if (session.simulator) {
      session.running = false;
      session.exitCode = 130;
      notifyWaiters(session);
    } else {
      session.process?.kill();
    }
  }
  return true;
}
