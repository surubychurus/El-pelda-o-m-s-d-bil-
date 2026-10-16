import { randomBytes, randomInt } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { defaultConfig, roomConfigSchema, type RoomConfig } from "./config.js";
import { db } from "./db/index.js";
import { players, roomPlayers, rooms } from "./db/schema.js";
import { broadcast } from "./hub.js";

const MAX_PLAYERS = 30;
// Sin I ni O para no confundirlas con 1 y 0
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

const newCode = () => Array.from({ length: 4 }, () => LETTERS[randomInt(LETTERS.length)]).join("");

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function getRoomByCode(code: string) {
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code.toUpperCase()));
  return room;
}

// Lo que ven los clientes de la sala (nunca incluye los qr_token)
export async function snapshot(roomId: string) {
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
  if (!room) return null;
  const members = await db
    .select({ id: players.id, nickname: players.nickname })
    .from(roomPlayers)
    .innerJoin(players, eq(players.id, roomPlayers.playerId))
    .where(eq(roomPlayers.roomId, roomId))
    .orderBy(asc(roomPlayers.joinedAt));
  return {
    code: room.code,
    status: room.status,
    ownerId: room.ownerId,
    config: room.config as RoomConfig,
    players: members,
  };
}

async function pushSnapshot(roomId: string) {
  broadcast(roomId, { type: "room", room: await snapshot(roomId) });
}

async function requireMember(roomId: string, playerId: string) {
  const [m] = await db
    .select()
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.playerId, playerId)));
  if (!m) throw new HttpError(403, "No estás en esta sala");
}

async function removePlayer(roomId: string, playerId: string) {
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
  if (!room) return;
  await db
    .delete(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.playerId, playerId)));
  const [next] = await db
    .select({ id: roomPlayers.playerId })
    .from(roomPlayers)
    .where(eq(roomPlayers.roomId, roomId))
    .orderBy(asc(roomPlayers.joinedAt))
    .limit(1);
  if (!next) {
    await db.delete(rooms).where(eq(rooms.id, roomId));
    return;
  }
  const config = room.config as RoomConfig;
  await db
    .update(rooms)
    .set({
      ownerId: room.ownerId === playerId ? next.id : room.ownerId,
      config: config.hunterId === playerId ? { ...config, hunterId: null } : config,
    })
    .where(eq(rooms.id, roomId));
  await pushSnapshot(roomId);
}

const codeParam = z.object({ code: z.string().length(4) });

export function registerRoomRoutes(app: FastifyInstance) {
  const auth = { preHandler: async (req: { jwtVerify: () => Promise<unknown> }) => void (await req.jwtVerify()) };
  const me = (req: { user: unknown }) => (req.user as { sub: string }).sub;

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message });
    if (err instanceof z.ZodError) return reply.code(400).send({ error: "Datos inválidos" });
    reply.send(err);
  });

  app.post("/rooms", auth, async (req) => {
    const playerId = me(req);
    for (let i = 0; i < 10; i++) {
      const code = newCode();
      try {
        const [room] = await db
          .insert(rooms)
          .values({ code, ownerId: playerId, config: defaultConfig })
          .returning();
        await db
          .insert(roomPlayers)
          .values({ roomId: room.id, playerId, qrToken: randomBytes(16).toString("hex") });
        return snapshot(room.id);
      } catch (e) {
        if ((e as { code?: string }).code !== "23505") throw e; // solo reintenta si el código ya existe
      }
    }
    throw new HttpError(500, "No se pudo generar un código de sala");
  });

  app.post("/rooms/join", auth, async (req) => {
    const playerId = me(req);
    const { code } = codeParam.parse(req.body);
    const room = await getRoomByCode(code);
    if (!room) throw new HttpError(404, "No existe esa sala");
    const members = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, room.id));
    if (members.some((m) => m.playerId === playerId)) return snapshot(room.id);
    if (room.status !== "lobby") throw new HttpError(409, "La partida ya empezó");
    if (members.length >= MAX_PLAYERS) throw new HttpError(409, "La sala está llena");
    await db
      .insert(roomPlayers)
      .values({ roomId: room.id, playerId, qrToken: randomBytes(16).toString("hex") });
    await pushSnapshot(room.id);
    return snapshot(room.id);
  });

  app.get("/rooms/:code", auth, async (req) => {
    const { code } = codeParam.parse(req.params);
    const room = await getRoomByCode(code);
    if (!room) throw new HttpError(404, "No existe esa sala");
    await requireMember(room.id, me(req));
    return snapshot(room.id);
  });

  app.patch("/rooms/:code/config", auth, async (req) => {
    const { code } = codeParam.parse(req.params);
    const config = roomConfigSchema.parse(req.body);
    const room = await getRoomByCode(code);
    if (!room) throw new HttpError(404, "No existe esa sala");
    if (room.ownerId !== me(req)) throw new HttpError(403, "Solo el creador puede configurar la sala");
    if (room.status !== "lobby") throw new HttpError(409, "La partida ya empezó");
    const members = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, room.id));
    if (config.hunterId && !members.some((m) => m.playerId === config.hunterId)) {
      throw new HttpError(400, "Ese cazador no está en la sala");
    }
    await db.update(rooms).set({ config }).where(eq(rooms.id, room.id));
    await pushSnapshot(room.id);
    return snapshot(room.id);
  });

  app.post("/rooms/:code/leave", auth, async (req) => {
    const { code } = codeParam.parse(req.params);
    const room = await getRoomByCode(code);
    if (!room) return { ok: true };
    await requireMember(room.id, me(req));
    await removePlayer(room.id, me(req));
    return { ok: true };
  });

  app.post("/rooms/:code/kick", auth, async (req) => {
    const { code } = codeParam.parse(req.params);
    const { playerId } = z.object({ playerId: z.string().uuid() }).parse(req.body);
    const room = await getRoomByCode(code);
    if (!room) throw new HttpError(404, "No existe esa sala");
    if (room.ownerId !== me(req)) throw new HttpError(403, "Solo el creador puede expulsar");
    if (playerId === me(req)) throw new HttpError(400, "No puedes expulsarte a ti mismo");
    if (room.status !== "lobby") throw new HttpError(409, "La partida ya empezó");
    await requireMember(room.id, playerId);
    await removePlayer(room.id, playerId);
    broadcast(room.id, { type: "kicked", playerId });
    return { ok: true };
  });
}
