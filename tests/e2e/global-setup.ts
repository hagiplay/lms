import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../../src/db/schema";
import { seed } from "../../src/db/seed-data";

export default async function setup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/lms_e2e";
  const admin = postgres(url.replace(/\/[^/]+$/, "/postgres"), { max: 1, onnotice: () => {} });
  const name = url.split("/").pop()!;
  const exists = await admin`select 1 from pg_database where datname = ${name}`;
  if (!exists.length) await admin.unsafe(`create database "${name}"`);
  await admin.end();

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  await seed(drizzle(sql, { schema }));
  await sql.end();
}
