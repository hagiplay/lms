import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/lms";
if (!/127\.0\.0\.1|localhost/.test(url) && process.env.ALLOW_REMOTE_RESET !== "1") {
  console.error("Refusing to reset a non-local database. Set ALLOW_REMOTE_RESET=1 if you really mean it.");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
await sql`drop schema if exists public cascade`;
await sql`drop schema if exists drizzle cascade`;
await sql`create schema public`;
await sql.end();
console.log("database reset");
