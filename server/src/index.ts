import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { z } from "zod";
import { db } from "./db/index.js";
import { players } from "./db/schema.js";

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("Falta JWT_SECRET");

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(jwt, { secret });
await app.register(websocket);

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

// Canal de tiempo real: de momento solo comprueba el token (fase 1 añade las salas)
app.get("/ws", { websocket: true }, (socket, req) => {
  const token = new URL(req.url, "http://x").searchParams.get("token") ?? "";
  try {
    const { sub } = app.jwt.verify<Auth>(token);
    socket.send(JSON.stringify({ type: "hello", playerId: sub }));
  } catch {
    socket.close(4401, "unauthorized");
  }
});

await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
