import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";
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
const port = Number(process.env.CODING_WS_PORT ?? process.env.PORT ?? 4001);
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 3;

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
  response.writeHead(404).end();
});
const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 2_100_000 });

httpServer.on("upgrade", (request, socket, head) => {
  void (async () => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
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

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`LynoraCoding collaboration websocket listening on port ${port}.`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    for (const room of rooms.values()) {
      if (room.persistTimer) clearTimeout(room.persistTimer);
      room.awareness.destroy();
      room.doc.destroy();
    }
    websocketServer.close();
    httpServer.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
