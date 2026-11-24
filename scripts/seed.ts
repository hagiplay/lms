import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { seed } from "../src/db/seed-data";

const url = process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/lms";
if (!/127\.0\.0\.1|localhost/.test(url) && process.env.ALLOW_REMOTE_SEED !== "1") {
  console.error("Refusing to seed (it TRUNCATEs every table) a non-local database. Set ALLOW_REMOTE_SEED=1 to override.");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
await seed(drizzle(sql, { schema }));
await sql.end();
console.log("seeded");
