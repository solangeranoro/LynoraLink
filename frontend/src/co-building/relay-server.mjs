// Relais local de test uniquement. L'application utilise le relais authentifié
// backend/scripts/coding-collaboration.ts pour les espaces de projets.
//   npm i ws && node relay-server.mjs
// Ne pas exposer ce relais sans authentification : il ne fait que transmettre les messages.
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT) || 8787;
const MAX_BYTES = 2 * 1024 * 1024; // un « state » complet peut être volumineux
const rooms = new Map(); // salle -> Set<WebSocket>

const wss = new WebSocketServer({ port: PORT, host: "127.0.0.1", maxPayload: MAX_BYTES });

wss.on("connection", (ws, req) => {
  const room = new URL(req.url, "http://x").searchParams.get("room") || "default";
  if (!/^[\w-]{1,64}$/.test(room)) return ws.close(1008, "salle invalide");
  if (!rooms.has(room)) rooms.set(room, new Set());
  const peers = rooms.get(room);
  peers.add(ws);
  ws.isAlive = true;

  ws.on("pong", () => { ws.isAlive = true; });
  ws.on("message", (data, isBinary) => {
    for (const p of peers) if (p !== ws && p.readyState === 1) p.send(data, { binary: isBinary });
  });
  ws.on("close", () => {
    peers.delete(ws);
    if (!peers.size) rooms.delete(room);
  });
});

// coupe les connexions mortes
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);

console.log(`Relais CoBuilding sur ws://localhost:${PORT}`);
