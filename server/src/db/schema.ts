import {
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const roomStatus = pgEnum("room_status", ["lobby", "waiting", "playing", "finished"]);
export const playerRole = pgEnum("player_role", ["hunter", "hider", "spectator"]);
export const playerState = pgEnum("player_state", ["alive", "captured"]);

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  nickname: text("nickname").notNull(),
  // Para vincular cuenta real más adelante (fase 5)
  email: text("email").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  ownerId: uuid("owner_id").notNull().references(() => players.id),
  status: roomStatus("status").notNull().default("lobby"),
  config: jsonb("config").notNull(),
  originLat: doublePrecision("origin_lat"),
  originLng: doublePrecision("origin_lng"),
  startedAt: timestamp("started_at"),
  winner: text("winner"), // "hunters" | "hiders"
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const roomPlayers = pgTable(
  "room_players",
  {
    roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    playerId: uuid("player_id").notNull().references(() => players.id),
    role: playerRole("role"),
    state: playerState("state").notNull().default("alive"),
    qrToken: text("qr_token").notNull(),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.playerId] })],
);

export const locations = pgTable(
  "locations",
  {
    roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    playerId: uuid("player_id").notNull().references(() => players.id),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.playerId] })],
);

export const captures = pgTable("captures", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  hunterId: uuid("hunter_id").notNull().references(() => players.id),
  hiderId: uuid("hider_id").notNull().references(() => players.id),
  at: timestamp("at").notNull().defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endsAt: timestamp("ends_at").notNull(),
  manual: integer("manual").notNull().default(0),
});
