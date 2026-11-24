import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL = "postgres://postgres@127.0.0.1:54329/lms";

const g = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };
const url = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

// Supabase's transaction pooler (port 6543) does not support prepared statements.
export const sql = g.__sql ?? postgres(url, { max: 10, prepare: !url.includes(":6543") });
if (process.env.NODE_ENV !== "production") g.__sql = sql;

export const db = drizzle(sql, { schema });
export type DB = typeof db;
export { schema };
