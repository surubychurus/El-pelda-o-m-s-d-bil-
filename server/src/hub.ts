import type { WebSocket } from "@fastify/websocket";

type Entry = { socket: WebSocket; playerId: string };

// Sockets suscritos a cada sala, con el jugador al que pertenecen
const rooms = new Map<string, Set<Entry>>();

export function subscribe(roomId: string, socket: WebSocket, playerId: string) {
  unsubscribe(socket);
  let set = rooms.get(roomId);
  if (!set) rooms.set(roomId, (set = new Set()));
  set.add({ socket, playerId });
}

export function unsubscribe(socket: WebSocket) {
  for (const [id, set] of rooms) {
    for (const e of set) if (e.socket === socket) set.delete(e);
    if (set.size === 0) rooms.delete(id);
  }
}

const send = (socket: WebSocket, message: unknown) => {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
};

export function broadcast(roomId: string, message: unknown) {
  for (const e of rooms.get(roomId) ?? []) send(e.socket, message);
}

// Envía a cada suscriptor un mensaje distinto (p. ej. los puntos sin su propia posición)
export function sendEach(roomId: string, build: (playerId: string) => unknown) {
  for (const e of rooms.get(roomId) ?? []) send(e.socket, build(e.playerId));
}

export function sendTo(roomId: string, playerId: string, message: unknown) {
  for (const e of rooms.get(roomId) ?? []) if (e.playerId === playerId) send(e.socket, message);
}
