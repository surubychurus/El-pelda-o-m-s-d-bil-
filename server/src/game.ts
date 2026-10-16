import { randomInt } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { RoomConfig } from "./config.js";
import { db } from "./db/index.js";
import { locations, roomPlayers, rooms } from "./db/schema.js";
import { maybeAutoAlert, pushPoints } from "./alerts.js";
import { HttpError, getRoomByCode, pushSnapshot, requireMember } from "./rooms.js";

const coords = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Cuántos cazadores toca según el modo
function hunterTarget(config: RoomConfig) {
  return config.mode === "classic" ? 1 : config.hunterCount;
}

export async function startGame(roomId: string, origin: { lat: number; lng: number }) {
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
  if (!room) throw new HttpError(404, "No existe esa sala");
  if (room.status !== "lobby") throw new HttpError(409, "La partida ya empezó");
  const config = room.config as RoomConfig;
  const members = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, roomId));
  const ids = members.map((m) => m.playerId);
  const hunters = hunterTarget(config);
  if (ids.length < 2) throw new HttpError(400, "Hacen falta al menos 2 jugadores");
  if (hunters >= ids.length) throw new HttpError(400, "Tiene que haber menos cazadores que jugadores");

  let hunterIds: string[];
  if (config.mode === "classic" && config.hunterPick === "manual") {
    if (!config.hunterId || !ids.includes(config.hunterId)) {
      throw new HttpError(400, "Elige quién es el cazador");
    }
    hunterIds = [config.hunterId];
  } else {
    hunterIds = shuffle(ids).slice(0, hunters);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(roomPlayers)
      .set({ role: "hider", state: "alive" })
      .where(eq(roomPlayers.roomId, roomId));
    await tx
      .update(roomPlayers)
      .set({ role: "hunter" })
      .where(and(eq(roomPlayers.roomId, roomId), inArray(roomPlayers.playerId, hunterIds)));
    await tx
      .update(rooms)
      .set({
        status: "waiting",
        startedAt: new Date(),
        originLat: origin.lat,
        originLng: origin.lng,
      })
      .where(eq(rooms.id, roomId));
  });
  await pushSnapshot(roomId);
}

// Termina la partida si ya no quedan escondidos vivos (o cazadores)
export async function settleIfOver(roomId: string) {
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
  if (!room || (room.status !== "waiting" && room.status !== "playing")) return;
  const members = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, roomId));
  const aliveHiders = members.filter((m) => m.role === "hider" && m.state === "alive").length;
  const hunters = members.filter((m) => m.role === "hunter").length;
  const winner = aliveHiders === 0 ? "hunters" : hunters === 0 ? "hiders" : null;
  if (winner) await finish(roomId, winner);
}

export async function finish(roomId: string, winner: "hunters" | "hiders") {
  await db
    .update(rooms)
    .set({ status: "finished", winner, finishedAt: new Date() })
    .where(and(eq(rooms.id, roomId), inArray(rooms.status, ["waiting", "playing"])));
  await pushSnapshot(roomId);
}

// Las fases salen de la hora de inicio, así que sobreviven a un reinicio del servidor
export async function tick(now = new Date()) {
  const active = await db
    .select()
    .from(rooms)
    .where(inArray(rooms.status, ["waiting", "playing"]));
  for (const room of active) {
    if (!room.startedAt) continue;
    const config = room.config as RoomConfig;
    const waitEnd = room.startedAt.getTime() + config.waitMin * 60_000;
    const gameEnd = waitEnd + config.durationMin * 60_000;
    if (now.getTime() >= gameEnd) {
      await finish(room.id, "hiders");
    } else if (room.status === "waiting" && now.getTime() >= waitEnd) {
      await db.update(rooms).set({ status: "playing" }).where(eq(rooms.id, room.id));
      await pushSnapshot(room.id);
    } else if (room.status === "playing") {
      await maybeAutoAlert(room, waitEnd, gameEnd, now.getTime());
      await pushPoints(room.id); // si hay alerta en curso, refresca los puntos
    }
  }
}

export function startScheduler() {
  const timer = setInterval(() => {
    tick().catch((e) => console.error("tick", e));
  }, 2000);
  return () => clearInterval(timer);
}

export function registerGameRoutes(app: FastifyInstance) {
  const auth = { preHandler: async (req: { jwtVerify: () => Promise<unknown> }) => void (await req.jwtVerify()) };
  const me = (req: { user: unknown }) => (req.user as { sub: string }).sub;
  const codeParam = z.object({ code: z.string().length(4) });

  app.post("/rooms/:code/start", auth, async (req) => {
    const { code } = codeParam.parse(req.params);
    const origin = coords.parse(req.body);
    const room = await getRoomByCode(code);
    if (!room) throw new HttpError(404, "No existe esa sala");
    if (room.ownerId !== me(req)) throw new HttpError(403, "Solo el creador puede empezar");
    await startGame(room.id, origin);
    return { ok: true };
  });

  // La app manda su posición periódicamente (también desde segundo plano)
  app.post("/rooms/:code/location", auth, async (req) => {
    const { code } = codeParam.parse(req.params);
    const { lat, lng } = coords.parse(req.body);
    const room = await getRoomByCode(code);
    if (!room) throw new HttpError(404, "No existe esa sala");
    await requireMember(room.id, me(req));
    if (room.status !== "waiting" && room.status !== "playing") return { ok: false };
    await db
      .insert(locations)
      .values({ roomId: room.id, playerId: me(req), lat, lng })
      .onConflictDoUpdate({
        target: [locations.roomId, locations.playerId],
        set: { lat, lng, updatedAt: new Date() },
      });
    return { ok: true };
  });
}
