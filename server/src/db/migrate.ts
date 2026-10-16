import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { db, pool } from "./index.js";

await migrate(db, { migrationsFolder: "./drizzle" });
await pool.end();
console.log("Migraciones aplicadas");
