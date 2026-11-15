const { Pool } = require("pg");
const { connectionOptions } = require("../lib/databaseConnection.mjs");
process.loadEnvFile(".qa/env.production");
async function main() {
  const keys = Object.keys(process.env).filter((k) =>
    /^(POSTGRES|DATABASE|SUPABASE)/.test(k),
  );
  console.log("Provisioned variable names:", keys.join(", "));
  for (const key of [
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_URL",
    "DATABASE_URL",
  ]) {
    if (!process.env[key]) continue;
    const url = new URL(process.env[key]);
    url.searchParams.set("sslmode", "verify-full");
    const db = new Pool({
      ...connectionOptions(url.href),
      max: 1,
      connectionTimeoutMillis: 10000,
    });
    try {
      const r = await db.query(
        "SELECT current_database() AS database, current_schema() AS schema, ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()",
      );
      console.log(
        key,
        "connectable:",
        r.rows.map((v) => ({
          database: v.database,
          schema: v.schema,
          tls: v.ssl,
        })),
      );
      break;
    } catch (e) {
      console.log(key, "connection failed:", e.code || "unavailable");
    } finally {
      await db.end();
    }
  }
}
main().catch(() => {
  console.error("Database inspection failed");
  process.exitCode = 1;
});
