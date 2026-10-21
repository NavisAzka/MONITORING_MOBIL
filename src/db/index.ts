import path from "path";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { importLegacyData } from "@/db/seed";

export type Database = NodePgDatabase<typeof schema>;

// One pool and one migration run per server process (survives Next.js dev reloads via globalThis).
const state = globalThis as typeof globalThis & { dbPool?: Pool; dbReady?: Promise<Database> };

async function open(): Promise<Database> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum diatur.");
  state.dbPool ??= new Pool({ connectionString, max: 10 });
  const db = drizzle(state.dbPool, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await importLegacyData(db);
  return db;
}

export function getDb() {
  state.dbReady ??= open().catch((error) => {
    state.dbReady = undefined; // retry on the next request instead of caching the failure
    throw error;
  });
  return state.dbReady;
}

export { schema };
