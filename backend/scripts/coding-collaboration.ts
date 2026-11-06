import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import next from "next";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import { WebSocket, WebSocketServer } from "ws";

type Role = "LEADER" | "CONTRIBUTOR" | "OBSERVER";
type Ticket = {
  teamId: string;
  filePath: string;
  userId: string;
  role: Role;
  expiresAt: number;
};
type ClientSocket = WebSocket & { userId: string; role: Role };
type CoBuildingTicket = {
  projectId: string;
  userId: string;
  clientId: string;
  userName: string;
  userImage?: string | null;
  expiresAt: number;
};
type CoBuildingSocket = WebSocket & { projectId: string; userId: string; clientId: string; userName: string; userImage?: string | null };
type CoBuildingIdentity = { id: string; name: string; color: string; image?: string | null };
type CoBuildingLine = { id: string; text: string; pos: number; ts: [number, string]; deleted: boolean };
type CoBuildingTask = {
  id: string;
  title: string;
  status: "todo" | "doing" | "done";
  assignee: { id: string; name: string; color: string } | null;
  at: number;
  ts: [number, string];
  deleted: boolean;
};
type CoBuildingChatMessage = {
  id: string;
  from: CoBuildingIdentity;
  text: string;
  at: number;
  replyTo?: string;
  deleted?: boolean;
};
type CoBuildingActivity = {
  id: string;
  actor: CoBuildingIdentity;
  action: "file_created" | "file_imported" | "file_modified" | "file_deleted" | "task_created" | "task_updated" | "task_deleted";
  target: string;
  at: number;
};
type CoBuildingState = {
  files: Map<string, Map<string, CoBuildingLine>>;
  tasks: Map<string, CoBuildingTask>;
  chat: Map<string, CoBuildingChatMessage>;
  history: CoBuildingActivity[];
  clock: number;
};
type Room = {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<ClientSocket>;
  fileId: string;
  content: string;
  lastSnapshotAt: number;
  persistTimer: ReturnType<typeof setTimeout> | null;
};

const prisma = new PrismaClient();
const rooms = new Map<string, Room>();
const coBuildingRooms = new Map<string, Set<CoBuildingSocket>>();
const coBuildingIdentities = new Map<string, Map<string, CoBuildingIdentity>>();
const coBuildingStates = new Map<string, CoBuildingState>();
const coBuildingLoads = new Map<string, Promise<CoBuildingState>>();
const coBuildingPersistTimers = new Map<string, ReturnType<typeof setTimeout>>();
const port = Number(process.env.CODING_WS_PORT ?? process.env.PORT ?? 4001);
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextApp = process.argv.includes("--with-next")
  ? next({ dev: false, dir: backendRoot, hostname: "0.0.0.0", port })
  : null;
const nextRequestHandler = nextApp?.getRequestHandler();
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 3;
const CO_BUILDING_COLORS = ["#2de2c8", "#8b6cff", "#ffc857", "#ff7a90", "#6fb7ff", "#9bf26b", "#ff9f5a", "#e08bff"];

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    if (url.protocol === "capacitor:" && url.hostname === "localhost") return "capacitor://localhost";
    return null;
  } catch {
    return null;
  }
}

function verifyCoBuildingTicket(token: string): CoBuildingTicket | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for co-building.");
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", secret).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  let ticket: CoBuildingTicket;
  try {
    ticket = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CoBuildingTicket;
  } catch {
    return null;
  }
  if (
    !ticket.projectId || !ticket.userId || !ticket.clientId || !ticket.userName ||
    !Number.isFinite(ticket.expiresAt) || ticket.expiresAt < Date.now()
  ) return null;
  return ticket;
}

function coBuildingColor(userId: string): string {
  let hash = 0;
  for (let index = 0; index < userId.length; index++) hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  return CO_BUILDING_COLORS[hash % CO_BUILDING_COLORS.length];
}

function emptyCoBuildingState(): CoBuildingState {
  return { files: new Map(), tasks: new Map(), chat: new Map(), history: [], clock: 0 };
}

function isNewerStamp(next: [number, string], current: [number, string]): boolean {
  return next[0] > current[0] || (next[0] === current[0] && next[1] > current[1]);
}

function isValidStamp(value: unknown): value is [number, string] {
  return Array.isArray(value) && value.length === 2 &&
    Number.isSafeInteger(value[0]) && value[0] >= 0 &&
    typeof value[1] === "string" && value[1].length <= 128;
}

function isValidLine(value: unknown): value is CoBuildingLine {
  if (!value || typeof value !== "object") return false;
  const line = value as CoBuildingLine;
  return typeof line.id === "string" && line.id.length <= 128 &&
    typeof line.text === "string" && line.text.length <= 20_000 &&
    Number.isFinite(line.pos) && isValidStamp(line.ts) &&
    typeof line.deleted === "boolean";
}

function isValidTask(value: unknown): value is CoBuildingTask {
  if (!value || typeof value !== "object") return false;
  const task = value as CoBuildingTask;
  return typeof task.id === "string" && task.id.length <= 128 &&
    typeof task.title === "string" && task.title.length <= 500 &&
    ["todo", "doing", "done"].includes(task.status) &&
    Number.isFinite(task.at) && isValidStamp(task.ts) &&
    typeof task.deleted === "boolean";
}

function isValidChatMessage(value: unknown): value is CoBuildingChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as CoBuildingChatMessage;
  return typeof message.id === "string" && message.id.length <= 128 &&
    typeof message.from?.id === "string" &&
    typeof message.from.name === "string" && typeof message.from.color === "string" &&
    typeof message.text === "string" && message.text.length <= 1_000 &&
    Number.isFinite(message.at) &&
    (message.replyTo === undefined || (typeof message.replyTo === "string" && message.replyTo.length <= 128)) &&
    (message.deleted === undefined || typeof message.deleted === "boolean");
}

function isValidCoBuildingActivity(value: unknown): value is CoBuildingActivity {
  if (!value || typeof value !== "object") return false;
  const activity = value as CoBuildingActivity;
  return typeof activity.id === "string" && activity.id.length <= 128 &&
    ["file_created", "file_imported", "file_modified", "file_deleted", "task_created", "task_updated", "task_deleted"].includes(activity.action) &&
    typeof activity.target === "string" && activity.target.length <= 128 &&
    Number.isFinite(activity.at);
}

function isValidCoBuildingBody(body: {
  t?: unknown;
  file?: unknown;
  lines?: unknown;
  task?: unknown;
  msg?: unknown;
  files?: unknown;
  tasks?: unknown;
  chat?: unknown;
  clock?: unknown;
  id?: unknown;
  activity?: unknown;
  history?: unknown;
}): boolean {
  if (body.t === "hello" || body.t === "presence") return true;
  if (body.t === "bye") return typeof body.id === "string" && body.id.length <= 128;
  if (body.t === "save") return typeof body.id === "string" && body.id.length > 0 && body.id.length <= 128;
  if (body.t === "chat_delete") return typeof body.id === "string" && body.id.length > 0 && body.id.length <= 128;
  if (body.t === "lines") {
    return typeof body.file === "string" && body.file.length <= 128 &&
      Array.isArray(body.lines) && body.lines.length <= 20_000 && body.lines.every(isValidLine);
  }
  if (body.t === "task") return isValidTask(body.task);
  if (body.t === "chat") return isValidChatMessage(body.msg);
  if (body.t === "activity") return isValidCoBuildingActivity(body.activity);
  if (body.t === "state") {
    return Array.isArray(body.files) && body.files.length <= 500 &&
      body.files.every((entry) => Array.isArray(entry) && typeof entry[0] === "string" &&
        entry[0].length <= 128 && Array.isArray(entry[1]) && entry[1].length <= 20_000 && entry[1].every(isValidLine)) &&
      Array.isArray(body.tasks) && body.tasks.length <= 10_000 && body.tasks.every(isValidTask) &&
      Array.isArray(body.chat) && body.chat.length <= 300 && body.chat.every(isValidChatMessage) &&
      (body.history === undefined || (Array.isArray(body.history) && body.history.length <= 1_000 && body.history.every(isValidCoBuildingActivity))) &&
      Number.isSafeInteger(body.clock) && Number(body.clock) >= 0;
  }
  return false;
}

function applyCoBuildingLine(state: CoBuildingState, file: string, line: CoBuildingLine) {
  let lines = state.files.get(file);
  if (!lines) {
    lines = new Map();
    state.files.set(file, lines);
  }
  const current = lines.get(line.id);
  if (!current || isNewerStamp(line.ts, current.ts)) lines.set(line.id, line);
  state.clock = Math.max(state.clock, line.ts[0]);
}

function mergeCoBuildingState(state: CoBuildingState, body: {
  t: string;
  files?: [string, CoBuildingLine[]][];
  tasks?: CoBuildingTask[];
  chat?: CoBuildingChatMessage[];
  history?: CoBuildingActivity[];
  clock?: number;
  file?: string;
  lines?: CoBuildingLine[];
  task?: CoBuildingTask;
  msg?: CoBuildingChatMessage;
}) {
  if (body.t === "state") {
    for (const [file, lines] of body.files ?? []) {
      for (const line of lines) applyCoBuildingLine(state, file, line);
    }
    for (const task of body.tasks ?? []) mergeCoBuildingTask(state, task);
    for (const message of body.chat ?? []) mergeCoBuildingChat(state, message);
    for (const activity of body.history ?? []) mergeCoBuildingActivity(state, activity);
    state.clock = Math.max(state.clock, body.clock ?? 0);
  } else if (body.t === "lines" && body.file && body.lines) {
    for (const line of body.lines) applyCoBuildingLine(state, body.file, line);
  } else if (body.t === "task" && body.task) {
    mergeCoBuildingTask(state, body.task);
  } else if (body.t === "chat" && body.msg) {
    mergeCoBuildingChat(state, body.msg);
  }
}

function mergeCoBuildingTask(state: CoBuildingState, task: CoBuildingTask) {
  const current = state.tasks.get(task.id);
  if (!current || isNewerStamp(task.ts, current.ts)) state.tasks.set(task.id, task);
  state.clock = Math.max(state.clock, task.ts[0]);
}

function mergeCoBuildingChat(state: CoBuildingState, message: CoBuildingChatMessage) {
  if (!state.chat.has(message.id)) state.chat.set(message.id, message);
  if (state.chat.size > 300) {
    const oldest = [...state.chat.values()].sort((a, b) => a.at - b.at)[0];
    if (oldest) state.chat.delete(oldest.id);
  }
}

function serializeCoBuildingState(state: CoBuildingState) {
  return {
    files: [...state.files].map(([file, lines]) => [file, [...lines.values()]] as [string, CoBuildingLine[]]),
    tasks: [...state.tasks.values()],
    chat: [...state.chat.values()],
    history: state.history,
    clock: state.clock,
  };
}

function mergeCoBuildingActivity(state: CoBuildingState, activity: CoBuildingActivity) {
  if (state.history.some((entry) => entry.id === activity.id)) return false;
  const recent = [...state.history].reverse().find((entry) =>
    entry.actor.id === activity.actor.id && entry.action === activity.action &&
    entry.target === activity.target && activity.action === "file_modified");
  if (recent && recent.actor.id === activity.actor.id && recent.action === activity.action &&
    recent.target === activity.target && activity.at - recent.at < 30_000) return false;
  state.history.push(activity);
  if (state.history.length > 1_000) state.history.splice(0, state.history.length - 1_000);
  return true;
}

async function loadCoBuildingState(projectId: string): Promise<CoBuildingState> {
  const cached = coBuildingStates.get(projectId);
  if (cached) return cached;

  const pendingLoad = coBuildingLoads.get(projectId);
  if (pendingLoad) return pendingLoad;

  const load = (async () => {
    const record = await prisma.projectCoBuildingState.findUnique({
      where: { projectId },
      select: { state: true },
    });
    const state = emptyCoBuildingState();
    if (record?.state && typeof record.state === "object" && !Array.isArray(record.state)) {
      const persisted = record.state as {
        files?: [string, CoBuildingLine[]][];
        tasks?: CoBuildingTask[];
        chat?: CoBuildingChatMessage[];
        history?: CoBuildingActivity[];
        clock?: number;
      };
      const snapshot = { t: "state", ...persisted, history: persisted.history ?? [] };
      if (isValidCoBuildingBody(snapshot)) {
        mergeCoBuildingState(state, snapshot);
      } else {
        console.error(`Ignoring invalid persisted co-building state for project ${projectId}.`);
      }
    }
    coBuildingStates.set(projectId, state);
    return state;
  })();
  coBuildingLoads.set(projectId, load);
  try {
    return await load;
  } finally {
    coBuildingLoads.delete(projectId);
  }
}

function scheduleCoBuildingPersist(projectId: string, state: CoBuildingState) {
  const previous = coBuildingPersistTimers.get(projectId);
  if (previous) clearTimeout(previous);
  coBuildingPersistTimers.set(projectId, setTimeout(() => {
    coBuildingPersistTimers.delete(projectId);
    void persistCoBuildingState(projectId, state);
  }, 500));
}

async function persistCoBuildingState(projectId: string, state: CoBuildingState) {
  try {
    const snapshot = serializeCoBuildingState(state) as Prisma.InputJsonValue;
    await prisma.projectCoBuildingState.upsert({
      where: { projectId },
      create: { projectId, state: snapshot },
      update: { state: snapshot },
    });
    return true;
  } catch (error) {
    console.error("Unable to persist project co-building state:", error);
    return false;
  }
}

async function saveCoBuildingState(projectId: string, state: CoBuildingState) {
  const timer = coBuildingPersistTimers.get(projectId);
  if (timer) {
    clearTimeout(timer);
    coBuildingPersistTimers.delete(projectId);
  }
  return persistCoBuildingState(projectId, state);
}

async function canAccessCoBuilding(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      creatorId: true,
      collaborators: {
        where: { userId, status: "APPROVED" },
        select: { id: true },
        take: 1,
      },
    },
  });
  return Boolean(project && (project.creatorId === userId || project.collaborators.length > 0));
}

function verifyTicket(token: string): Ticket | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for coding collaboration.");
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  let ticket: Ticket;
  try {
    ticket = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Ticket;
  } catch {
    return null;
  }
  if (
    !ticket.teamId || !ticket.filePath || !ticket.userId ||
    !["LEADER", "CONTRIBUTOR", "OBSERVER"].includes(ticket.role) ||
    !Number.isFinite(ticket.expiresAt) || ticket.expiresAt < Date.now()
  ) return null;
  return ticket;
}

function isSafePath(filePath: string): boolean {
  return filePath.length > 0 && filePath.length <= 512 &&
    !filePath.startsWith("/") && !filePath.includes("\\") &&
    filePath.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

function sendAwareness(socket: WebSocket, awareness: awarenessProtocol.Awareness) {
  const clients = [...awareness.getStates().keys()];
  if (!clients.length) return;
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, clients));
  socket.send(encoding.toUint8Array(encoder));
}

async function canAccess(ticket: Ticket): Promise<Role | null> {
  const team = await prisma.project.findUnique({
    where: { id: ticket.teamId },
    select: {
      teamName: true,
      creatorId: true,
      collaborators: {
        where: { userId: ticket.userId, status: "APPROVED" },
        select: { codingRole: true },
        take: 1,
      },
    },
  });
  if (!team?.teamName?.trim()) return null;
  if (team.creatorId === ticket.userId) return "LEADER";
  return team.collaborators[0]?.codingRole ?? null;
}

async function loadRoom(teamId: string, filePath: string): Promise<Room> {
  const roomKey = `${teamId}/${filePath}`;
  const cached = rooms.get(roomKey);
  if (cached) return cached;

  const workspace = await prisma.codingWorkspace.findUnique({
    where: { teamId },
    select: { id: true },
  });
  if (!workspace) throw new Error("The team coding workspace was not found.");
  const file = await prisma.codingFile.findUnique({
    where: { workspaceId_path: { workspaceId: workspace.id, path: filePath } },
    select: { id: true, isDirectory: true, content: true },
  });
  if (!file || file.isDirectory) throw new Error("The shared workspace file was not found.");

  const doc = new Y.Doc();
  const text = doc.getText("monaco");
  if (file.content) text.insert(0, file.content);
  const awareness = new awarenessProtocol.Awareness(doc);
  const room: Room = {
    doc,
    awareness,
    clients: new Set(),
    fileId: file.id,
    content: file.content,
    lastSnapshotAt: 0,
    persistTimer: null,
  };
  rooms.set(roomKey, room);

  doc.on("update", (update: Uint8Array, origin: unknown) => {
    const source = [...room.clients].find((client) => client === origin) ?? null;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);
    for (const client of room.clients) {
      if (client !== source && client.readyState === WebSocket.OPEN) client.send(message);
    }

    if (room.persistTimer) clearTimeout(room.persistTimer);
    room.persistTimer = setTimeout(() => {
      room.persistTimer = null;
      const nextContent = text.toString();
      if (nextContent === room.content) return;
      const authorId = source?.userId ?? [...room.clients][0]?.userId;
      void prisma.codingFile.update({
        where: { id: room.fileId },
        data: { content: nextContent },
      }).then(async () => {
        if (authorId && Date.now() - room.lastSnapshotAt >= 30_000) {
          await prisma.codingFileVersion.create({
            data: { fileId: room.fileId, authorId, content: room.content },
          });
          room.lastSnapshotAt = Date.now();
        }
        room.content = nextContent;
      }).catch((error: unknown) => {
        console.error("Unable to persist a collaborative coding document:", error);
      });
    }, 750);
  });

  awareness.on("update", ({ added, updated, removed }: {
    added: number[];
    updated: number[];
    removed: number[];
  }, origin: unknown) => {
    const changed = [...added, ...updated, ...removed];
    if (!changed.length) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changed));
    const message = encoding.toUint8Array(encoder);
    for (const client of room.clients) {
      if (client !== origin && client.readyState === WebSocket.OPEN) client.send(message);
    }
  });
  return room;
}

const httpServer = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (!nextRequestHandler) {
    response.writeHead(404).end();
    return;
  }
  void nextRequestHandler(request, response).catch((error: unknown) => {
    console.error("Unable to handle a LynoraLink API request:", error);
    if (!response.headersSent) response.writeHead(500);
    response.end("Internal server error.");
  });
});
const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 2_100_000 });

httpServer.on("upgrade", (request, socket, head) => {
  void (async () => {
    if (process.env.NODE_ENV === "production") {
      const requestOrigin = request.headers.origin;
      const allowedOrigins = [
        process.env.NEXT_PUBLIC_APP_URL,
        ...(process.env.WSS_ALLOWED_ORIGINS ?? "").split(","),
      ].map((origin) => origin?.trim()).filter((origin): origin is string => Boolean(origin));
      if (!requestOrigin || !allowedOrigins.length) return socket.destroy();
      const origin = normalizeOrigin(requestOrigin);
      if (!origin || !allowedOrigins.some((allowedOrigin) => normalizeOrigin(allowedOrigin) === origin)) return socket.destroy();
    }
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname === "/co-building") {
      const ticket = verifyCoBuildingTicket(url.searchParams.get("ticket") ?? "");
      if (!ticket || !(await canAccessCoBuilding(ticket.projectId, ticket.userId))) {
        return socket.destroy();
      }
      const state = await loadCoBuildingState(ticket.projectId);

      websocketServer.handleUpgrade(request, socket, head, (connection) => {
        const client = connection as CoBuildingSocket;
        client.projectId = ticket.projectId;
        client.userId = ticket.userId;
        client.clientId = ticket.clientId;
        client.userName = ticket.userName;
        const peers = coBuildingRooms.get(ticket.projectId) ?? new Set<CoBuildingSocket>();
        const identities = coBuildingIdentities.get(ticket.projectId) ?? new Map<string, CoBuildingIdentity>();
        client.userImage = ticket.userImage;
        const signedUser = { id: client.clientId, name: client.userName, color: coBuildingColor(client.clientId), image: client.userImage };
        peers.add(client);
        identities.set(client.clientId, signedUser);
        coBuildingRooms.set(ticket.projectId, peers);
        coBuildingIdentities.set(ticket.projectId, identities);

        let accessCheckFailures = 0;
        const accessTimer = setInterval(() => {
          void canAccessCoBuilding(client.projectId, client.userId).then((hasAccess) => {
            accessCheckFailures = 0;
            if (!hasAccess && client.readyState === WebSocket.OPEN) {
              client.close(4403, "Project collaboration access was revoked.");
            }
          }).catch((error: unknown) => {
            accessCheckFailures++;
            console.error("Unable to revalidate project co-building access:", error);
            if (accessCheckFailures >= 3 && client.readyState === WebSocket.OPEN) {
              client.close(1011, "Unable to verify project access.");
            }
          });
        }, 30_000);

        client.on("message", async (data, isBinary) => {
          if (isBinary || client.readyState !== WebSocket.OPEN) {
            client.close(1008, "Invalid collaboration message.");
            return;
          }

          let envelope: {
            room?: unknown;
            from?: unknown;
            body?: {
              t?: unknown;
              id?: unknown;
              user?: { id?: unknown; name?: string; color?: string };
              p?: { user?: { id?: unknown; name?: string; color?: string } };
              msg?: { from?: { id?: unknown; name?: string; color?: string } };
              activity?: CoBuildingActivity;
              chat?: { id?: string; from?: { id?: string; name?: string; color?: string } }[];
              history?: CoBuildingActivity[];
              file?: unknown;
              lines?: unknown;
              task?: unknown;
              files?: unknown;
              tasks?: unknown;
              clock?: unknown;
            };
          };
          try {
            envelope = JSON.parse(data.toString()) as typeof envelope;
          } catch {
            client.close(1008, "Invalid collaboration message.");
            return;
          }

          const body = envelope.body;
          const supportedTypes = ["hello", "state", "lines", "task", "chat", "chat_delete", "activity", "save", "presence", "bye"];
          if (
            envelope.room !== client.projectId ||
            envelope.from !== client.clientId ||
            !body ||
            typeof body.t !== "string" ||
            !supportedTypes.includes(body.t) ||
            !isValidCoBuildingBody(body)
          ) {
            client.close(1008, "Invalid collaboration message.");
            return;
          }

          if (body.t === "hello") {
            if (body.user?.id !== client.clientId) {
              client.close(1008, "Invalid collaboration identity.");
              return;
            }
            body.user = signedUser;
          } else if (body.t === "presence") {
            if (body.p?.user?.id !== client.clientId) {
              client.close(1008, "Invalid collaboration identity.");
              return;
            }
            body.p.user = signedUser;
          } else if (body.t === "chat") {
            if (body.msg?.from?.id !== client.clientId) {
              client.close(1008, "Invalid collaboration identity.");
              return;
            }
            body.msg.from = signedUser;
          } else if (body.t === "chat_delete") {
            const target = typeof body.id === "string" ? state.chat.get(body.id) : undefined;
            if (!target || target.from.id !== client.clientId) {
              client.send(JSON.stringify({
                room: client.projectId,
                from: "server",
                body: { t: "chat_delete_result", id: body.id, success: false },
              }));
              return;
            }
            if (!target.deleted) state.chat.set(target.id, { ...target, deleted: true });
            scheduleCoBuildingPersist(client.projectId, state);
            client.send(JSON.stringify({
              room: client.projectId,
              from: "server",
              body: { t: "chat_delete_result", id: target.id, success: true },
            }));
          } else if (body.t === "state" && Array.isArray(body.chat)) {
            body.chat = body.chat.flatMap((message) => {
              const identity = message.from?.id ? identities.get(message.from.id) : undefined;
              return identity ? [{ ...message, from: identity }] : [];
            });
            body.history = state.history;
          } else if (body.t === "bye" && body.id !== client.clientId) {
            client.close(1008, "Invalid collaboration identity.");
            return;
          }

          if (body.t === "activity" && body.activity) {
            body.activity = { ...body.activity, actor: signedUser, at: Date.now() };
            if (!mergeCoBuildingActivity(state, body.activity)) return;
            scheduleCoBuildingPersist(client.projectId, state);
          }

          if (body.t === "save" && typeof body.id === "string") {
            const success = await saveCoBuildingState(client.projectId, state);
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                room: client.projectId,
                from: "server",
                body: { t: "save_result", id: body.id, success },
              }));
            }
            return;
          } else if (body.t === "hello") {
            client.send(JSON.stringify({
              room: client.projectId,
              from: "server",
              body: { t: "state", to: client.clientId, ...serializeCoBuildingState(state) },
            }));
          } else if (["state", "lines", "task", "chat"].includes(body.t)) {
            mergeCoBuildingState(state, body as Parameters<typeof mergeCoBuildingState>[1]);
            scheduleCoBuildingPersist(client.projectId, state);
          }

          const message = JSON.stringify(envelope);
          for (const peer of peers) {
            if (peer !== client && peer.readyState === WebSocket.OPEN) peer.send(message);
          }
        });
        client.on("close", () => {
          clearInterval(accessTimer);
          peers.delete(client);
          if (!peers.size) {
            coBuildingRooms.delete(client.projectId);
            coBuildingIdentities.delete(client.projectId);
          }
        });
      });
      return;
    }

    const parts = url.pathname.slice(1).split("/");
    if (parts.length < 2) return socket.destroy();
    const teamId = decodeURIComponent(parts[0]);
    const filePath = decodeURIComponent(parts.slice(1).join("/"));
    const ticket = verifyTicket(url.searchParams.get("token") ?? "");
    if (!ticket || ticket.teamId !== teamId || ticket.filePath !== filePath || !isSafePath(filePath)) {
      return socket.destroy();
    }
    const role = await canAccess(ticket);
    if (!role) return socket.destroy();

    websocketServer.handleUpgrade(request, socket, head, (connection) => {
      const client = connection as ClientSocket;
      client.userId = ticket.userId;
      client.role = role;
      void loadRoom(teamId, filePath).then((room) => {
        room.clients.add(client);
        const accessTimer = setInterval(() => {
          void canAccess(ticket).then((currentRole) => {
            if (currentRole !== role && client.readyState === WebSocket.OPEN) {
              client.close(4403, "Team coding permissions changed.");
            }
          }).catch((error: unknown) => {
            console.error("Unable to revalidate coding collaboration access:", error);
            client.close(1011, "Unable to verify team access.");
          });
        }, 30_000);
        sendAwareness(client, room.awareness);
        client.on("message", (data, isBinary) => {
          if (!isBinary || client.readyState !== WebSocket.OPEN) return;
          const bytes = new Uint8Array(data as Buffer);
          const decoder = decoding.createDecoder(bytes);
          const messageType = decoding.readVarUint(decoder);
          if (messageType === MESSAGE_SYNC) {
            const syncType = decoding.readVarUint(decoder);
            if (syncType !== syncProtocol.messageYjsSyncStep1 && role === "OBSERVER") return;
            const syncDecoder = decoding.createDecoder(bytes);
            decoding.readVarUint(syncDecoder);
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MESSAGE_SYNC);
            syncProtocol.readSyncMessage(syncDecoder, encoder, room.doc, client);
            if (encoding.length(encoder) > 1) client.send(encoding.toUint8Array(encoder));
          } else if (messageType === MESSAGE_AWARENESS) {
            awarenessProtocol.applyAwarenessUpdate(
              room.awareness,
              decoding.readVarUint8Array(decoder),
              client,
            );
          } else if (messageType === MESSAGE_QUERY_AWARENESS) {
            sendAwareness(client, room.awareness);
          }
        });
        client.on("close", () => {
          clearInterval(accessTimer);
          room.clients.delete(client);
          const departing = [...room.awareness.getStates().entries()]
            .filter(([, state]) => {
              if (!state || typeof state !== "object" || !("user" in state)) return false;
              const user = state.user;
              return Boolean(user && typeof user === "object" && "id" in user && user.id === client.userId);
            })
            .map(([clientId]) => clientId);
          if (departing.length) awarenessProtocol.removeAwarenessStates(room.awareness, departing, client);
        });
      }).catch((error: unknown) => {
        console.error("Unable to open a collaborative coding document:", error);
        client.close(1011, "Unable to open the shared document.");
      });
    });
  })().catch((error: unknown) => {
    console.error("Unable to authorize a coding collaboration connection:", error);
    socket.destroy();
  });
});

void (nextApp?.prepare() ?? Promise.resolve()).then(() => {
  httpServer.listen(port, "0.0.0.0", () => {
    const service = nextApp ? "LynoraLink API and collaboration" : "LynoraCoding collaboration websocket";
    console.log(`${service} server listening on port ${port}.`);
  });
}).catch((error: unknown) => {
  console.error("Unable to prepare the LynoraLink server:", error);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    for (const timer of coBuildingPersistTimers.values()) clearTimeout(timer);
    coBuildingPersistTimers.clear();
    for (const room of rooms.values()) {
      if (room.persistTimer) clearTimeout(room.persistTimer);
      room.awareness.destroy();
      room.doc.destroy();
    }
    void Promise.all([...coBuildingStates].map(([projectId, state]) => persistCoBuildingState(projectId, state)))
      .then(() => {
        websocketServer.close();
        httpServer.close(() => {
          void Promise.all([
            ...(nextApp ? [nextApp.close()] : []),
            prisma.$disconnect(),
          ])
            .then(() => process.exit(0))
            .catch((error: unknown) => {
              console.error("Unable to shut down the LynoraLink server cleanly:", error);
              process.exitCode = 1;
            });
        });
      });
  });
}
