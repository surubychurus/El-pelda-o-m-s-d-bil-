import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { z } from "zod";
import { db } from "./db/index.js";
import { players } from "./db/schema.js";
import { registerAlertRoutes } from "./alerts.js";
import { registerGameRoutes, startScheduler } from "./game.js";
import { subscribe, unsubscribe } from "./hub.js";
import { getRoomByCode, registerRoomRoutes, snapshot } from "./rooms.js";

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("Falta JWT_SECRET");

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(jwt, { secret });
await app.register(websocket);

// Acepta POST con content-type json y cuerpo vacío (p. ej. crear sala o salir)
app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
  try {
    done(null, body ? JSON.parse(body as string) : {});
  } catch {
    done(new Error("JSON inválido"), undefined);
  }
});

type Auth = { sub: string };

const nicknameSchema = z.object({ nickname: z.string().trim().min(2).max(20) });

const authenticate = async (req: { jwtVerify: () => Promise<unknown> }) => {
  await req.jwtVerify();
};

app.get("/health", async () => ({ ok: true }));

// Crea un jugador con solo un apodo y devuelve su token
app.post("/auth/guest", async (req, reply) => {
  const parsed = nicknameSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: "Apodo inválido (2-20 caracteres)" });
  const [player] = await db.insert(players).values({ nickname: parsed.data.nickname }).returning();
  const token = app.jwt.sign({ sub: player.id } satisfies Auth, { expiresIn: "365d" });
  return { token, player };
});

app.get("/me", { preHandler: authenticate }, async (req, reply) => {
  const { sub } = req.user as Auth;
  const [player] = await db.select().from(players).where(eq(players.id, sub));
  if (!player) return reply.code(404).send({ error: "Jugador no encontrado" });
  return player;
});

// Cambiar apodo
app.patch("/me", { preHandler: authenticate }, async (req, reply) => {
  const parsed = nicknameSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: "Apodo inválido (2-20 caracteres)" });
  const { sub } = req.user as Auth;
  const [player] = await db
    .update(players)
    .set({ nickname: parsed.data.nickname })
    .where(eq(players.id, sub))
    .returning();
  return player;
});

registerRoomRoutes(app);
registerGameRoutes(app);
registerAlertRoutes(app);
startScheduler();

// Tiempo real: el cliente se conecta con ?token= y envía {type:"subscribe", code}
app.get("/ws", { websocket: true }, (socket, req) => {
  const token = new URL(req.url, "http://x").searchParams.get("token") ?? "";
  let playerId: string;
  try {
    playerId = app.jwt.verify<Auth>(token).sub;
  } catch {
    socket.close(4401, "unauthorized");
    return;
  }
  socket.on("message", async (raw: Buffer) => {
    try {
      const msg = z.object({ type: z.literal("subscribe"), code: z.string().length(4) }).parse(JSON.parse(raw.toString()));
      const room = await getRoomByCode(msg.code);
      const snap = room && (await snapshot(room.id));
      if (!room || !snap?.players.some((p) => p.id === playerId)) {
        socket.send(JSON.stringify({ type: "error", error: "No estás en esta sala" }));
        return;
      }
      subscribe(room.id, socket, playerId);
      socket.send(JSON.stringify({ type: "room", room: snap }));
    } catch {
      socket.send(JSON.stringify({ type: "error", error: "Mensaje inválido" }));
    }
  });
  socket.on("close", () => unsubscribe(socket));
  socket.send(JSON.stringify({ type: "hello", playerId }));
});

await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
