import type { WebSocket } from "@fastify/websocket";

// Sockets suscritos a cada sala
const rooms = new Map<string, Set<WebSocket>>();

export function subscribe(roomId: string, socket: WebSocket) {
  unsubscribe(socket);
  let set = rooms.get(roomId);
  if (!set) rooms.set(roomId, (set = new Set()));
  set.add(socket);
}

export function unsubscribe(socket: WebSocket) {
  for (const [id, set] of rooms) {
    set.delete(socket);
    if (set.size === 0) rooms.delete(id);
  }
}

export function broadcast(roomId: string, message: unknown) {
  const data = JSON.stringify(message);
  for (const socket of rooms.get(roomId) ?? []) {
    if (socket.readyState === socket.OPEN) socket.send(data);
  }
}
