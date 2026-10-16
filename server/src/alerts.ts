import { randomInt } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { RoomConfig } from "./config.js";
import { db } from "./db/index.js";
import { alerts, captures, locations, players, roomPlayers, rooms } from "./db/schema.js";
import { settleIfOver } from "./game.js";
import { distanceMeters } from "./geo.js";
import { sendEach, sendTo } from "./hub.js";
import { HttpError, getRoomByCode, pushSnapshot, requireMember } from "./rooms.js";

// Distancia máxima entre cazador y escondido para validar una captura por QR.
// El GPS de dos móviles falla varios metros cada uno, por eso es generosa.
export const CAPTURE_MAX_M = 50;
// Las ubicaciones más viejas que esto no se enseñan ni se usan para validar
const MAX_AGE_S = 600;
const STALE_FOR_CAPTURE_S = 180;

export async function activeAlert(roomId: string, now = new Date()) {
  const [a] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.roomId, roomId), gt(alerts.endsAt, now)))
    .orderBy(desc(alerts.startedAt))
    .limit(1);
  return a ?? null;
}

export async function startAlert(roomId: string, config: RoomConfig, manual: boolean) {
  const now = Date.now();
  const [a] = await db
    .insert(alerts)
    .values({
      roomId,
      startedAt: new Date(now),
      endsAt: new Date(now + config.alertDurationSec * 1000),
      manual: manual ? 1 : 0,
    })
    .returning();
  await pushSnapshot(roomId);
  await pushPoints(roomId);
  return a;
}

type Point = { playerId: string; lat: number; lng: number; hunter: boolean; age: number };

// Posiciones de quienes siguen en juego (cazadores y escondidos vivos)
async function livePoints(roomId: string): Promise<Point[]> {
  const rows = await db
    .select({
      playerId: locations.playerId,
      lat: locations.lat,
      lng: locations.lng,
      updatedAt: locations.updatedAt,
      role: roomPlayers.role,
      state: roomPlayers.state,
    })
    .from(locations)
    .innerJoin(
      roomPlayers,
      and(eq(roomPlayers.roomId, locations.roomId), eq(roomPlayers.playerId, locations.playerId)),
    )
    .where(eq(locations.roomId, roomId));
  const now = Date.now();
  return rows
    .filter((r) => (r.role === "hunter" || r.role === "hider") && r.state === "alive")
    .map((r) => ({
      playerId: r.playerId,
      lat: r.lat,
      lng: r.lng,
      hunter: r.role === "hunter",
      age: Math.round((now - r.updatedAt.getTime()) / 1000),
    }))
    .filter((p) => p.age <= MAX_AGE_S);
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Cada jugador recibe los puntos de los demás, sin identificadores y en orden aleatorio
export async function pushPoints(roomId: string) {
  const alert = await activeAlert(roomId);
  if (!alert) return;
  const pts = await livePoints(roomId);
  sendEach(roomId, (me) => ({
    type: "points",
    alertId: alert.id,
    points: shuffle(pts.filter((p) => p.playerId !== me)).map(({ lat, lng, hunter, age }) => ({
      lat,
      lng,
      hunter,
      age,
    })),
  }));
}

// Alertas automáticas: una cada `alertEveryMin`, contando desde que salen los cazadores
export async function maybeAutoAlert(
  room: { id: string; config: unknown },
  waitEnd: number,
  gameEnd: number,
  now: number,
) {
  const config = room.config as RoomConfig;
  const every = config.alertEveryMin * 60_000;
  const [last] = await db
    .select()
    .from(alerts)
    .where(eq(alerts.roomId, room.id))
    .orderBy(desc(alerts.startedAt))
    .limit(1);
  const ref = last ? last.startedAt.getTime() : waitEnd;
  // No tiene sentido lanzar una alerta si no cabe entera antes de que acabe la partida
  if (now >= ref + every && now + config.alertDurationSec * 1000 <= gameEnd) {
    await startAlert(room.id, config, false);
  }
}

export function registerAlertRoutes(app: FastifyInstance) {
  const auth = { preHandler: async (req: { jwtVerify: () => Promise<unknown> }) => void (await req.jwtVerify()) };
  const me = (req: { user: unknown }) => (req.user as { sub: string }).sub;
  const codeParam = z.object({ code: z.string().length(4) });

  // El creador lanza una alerta a mano
  app.post("/rooms/:code/alert", auth, async (req) => {
    const { code } = codeParam.parse(req.params);
    const room = await getRoomByCode(code);
    if (!room) throw new HttpError(404, "No existe esa sala");
    if (room.ownerId !== me(req)) throw new HttpError(403, "Solo el creador puede lanzar la alerta");
    if (room.status !== "playing") throw new HttpError(409, "La alerta solo se puede lanzar durante la partida");
    if (await activeAlert(room.id)) throw new HttpError(409, "Ya hay una alerta en curso");
    await startAlert(room.id, room.config as RoomConfig, true);
    return { ok: true };
  });

  // Por si el cliente se conecta con la alerta ya en curso
  app.get("/rooms/:code/points", auth, async (req) => {
    const { code } = codeParam.parse(req.params);
    const room = await getRoomByCode(code);
    if (!room) throw new HttpError(404, "No existe esa sala");
    await requireMember(room.id, me(req));
    const alert = await activeAlert(room.id);
    if (!alert) return { alertId: null, points: [] };
    const pts = await livePoints(room.id);
    return {
      alertId: alert.id,
      points: shuffle(pts.filter((p) => p.playerId !== me(req))).map(({ lat, lng, hunter, age }) => ({
        lat,
        lng,
        hunter,
        age,
      })),
    };
  });

  // Mi propio QR (solo el dueño lo puede ver)
  app.get("/rooms/:code/qr", auth, async (req) => {
    const { code } = codeParam.parse(req.params);
    const room = await getRoomByCode(code);
    if (!room) throw new HttpError(404, "No existe esa sala");
    const [m] = await db
      .select()
      .from(roomPlayers)
      .where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.playerId, me(req))));
    if (!m) throw new HttpError(403, "No estás en esta sala");
    return { token: m.qrToken };
  });

  // El cazador escanea el QR de un escondido
  app.post("/rooms/:code/capture", auth, async (req) => {
    const { code } = codeParam.parse(req.params);
    const { token, lat, lng } = z
      .object({
        token: z.string().min(8).max(100),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .parse(req.body);
    const room = await getRoomByCode(code);
    if (!room) throw new HttpError(404, "No existe esa sala");
    if (room.status !== "playing") throw new HttpError(409, "Todavía no se puede capturar");

    const [hunter] = await db
      .select()
      .from(roomPlayers)
      .where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.playerId, me(req))));
    if (!hunter || hunter.role !== "hunter") throw new HttpError(403, "Solo los cazadores pueden capturar");

    const members = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, room.id));
    const target = members.find((m) => m.qrToken === token);
    if (!target) throw new HttpError(404, "QR no válido para esta sala");
    if (target.role !== "hider" || target.state !== "alive") throw new HttpError(409, "Ese jugador no se puede capturar");

    // Anti-trampas: el escondido tiene que estar cerca del cazador (si sabemos dónde está)
    const [loc] = await db
      .select()
      .from(locations)
      .where(and(eq(locations.roomId, room.id), eq(locations.playerId, target.playerId)));
    if (loc && (Date.now() - loc.updatedAt.getTime()) / 1000 <= STALE_FOR_CAPTURE_S) {
      const d = distanceMeters(lat, lng, loc.lat, loc.lng);
      if (d > CAPTURE_MAX_M) throw new HttpError(409, `Está demasiado lejos (${Math.round(d)} m)`);
    }

    const config = room.config as RoomConfig;
    await db.insert(captures).values({ roomId: room.id, hunterId: me(req), hiderId: target.playerId });
    await db
      .update(roomPlayers)
      .set(
        config.onCapture === "hunter"
          ? { role: "hunter", state: "alive" }
          : { role: "spectator", state: "captured" },
      )
      .where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.playerId, target.playerId)));

    const [victim] = await db.select().from(players).where(eq(players.id, target.playerId));
    sendTo(room.id, target.playerId, { type: "captured", by: me(req), onCapture: config.onCapture });
    await settleIfOver(room.id);
    await pushSnapshot(room.id);
    return { ok: true, nickname: victim?.nickname ?? "" };
  });
}
