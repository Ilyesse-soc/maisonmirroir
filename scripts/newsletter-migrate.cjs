const { Pool } = require("pg");
const { connectionOptions } = require("../lib/databaseConnection.mjs");
const { readFileSync, readdirSync } = require("node:fs");
const { createHash } = require("node:crypto");
if (process.env.MM_ENV_FILE) process.loadEnvFile(process.env.MM_ENV_FILE);
else require("@next/env").loadEnvConfig(process.cwd());
async function main() {
  const url =
    process.env.NEWSLETTER_MIGRATION_URL ||
    process.env.NEWSLETTER_DATABASE_URL ||
    process.env.DATABASE_URL;
  if (!url) throw Error("Database required");
  const db = new Pool({ ...connectionOptions(url), max: 1 });
  const client = await db.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('mm-migrations'))");
    await client.query(
      "CREATE TABLE IF NOT EXISTS mm_schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of readdirSync("migrations")
      .filter((n) => /^\d+_.*\.sql$/.test(n))
      .sort()) {
      const source = readFileSync("migrations/" + name, "utf8"),
        checksum = createHash("sha256").update(source).digest("hex");
      const existing = (
        await client.query(
          "SELECT checksum FROM mm_schema_migrations WHERE name=$1",
          [name],
        )
      ).rows[0];
      if (existing) {
        if (existing.checksum !== checksum)
          throw Error("MIGRATION_CHECKSUM_MISMATCH");
        continue;
      }
      await client.query(source);
      await client.query(
        "INSERT INTO mm_schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
      console.log("Applied migration:", name);
    }
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('mm-migrations'))")
      .catch(() => {});
    client.release();
    await db.end();
  }
}
main().catch(() => {
  console.error(
    "Migration failed. Check configuration, privileges and migration checksums.",
  );
  process.exitCode = 1;
});
