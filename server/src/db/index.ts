import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon exige SSL; sslmode=require ya viene en la cadena de conexión
});
export const db = drizzle(pool, { schema });
