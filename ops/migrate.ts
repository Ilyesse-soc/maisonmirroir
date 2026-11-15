import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { getMigrations } from "better-auth/db/migration";
import { database } from "../lib/newsletterDb";
import { makeAuth } from "../lib/authConfiguration";
const db = database(),
  client = await db.connect();
try {
  await client.query("SELECT pg_advisory_lock(hashtext('mm-migrations'))");
  await client.query(
    "CREATE TABLE IF NOT EXISTS mm_schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await fs.readdir("migrations"))
    .filter((n) => /^\d+_.*\.sql$/.test(n))
    .sort()) {
    const sql = await fs.readFile(path.join("migrations", name), "utf8"),
      checksum = createHash("sha256").update(sql).digest("hex");
    const old = (
      await client.query(
        "SELECT checksum FROM mm_schema_migrations WHERE name=$1",
        [name],
      )
    ).rows[0];
    if (old) {
      if (old.checksum !== checksum) throw Error("MIGRATION_CHECKSUM_MISMATCH");
      continue;
    }
    await client.query(sql);
    await client.query(
      "INSERT INTO mm_schema_migrations(name,checksum) VALUES($1,$2)",
      [name, checksum],
    );
    console.info("Applied migration: " + name);
  }
  const migration = await getMigrations(makeAuth(db).options, {
    throwOnUnsafe: true,
  });
  if (migration.unsafeChanges.length || migration.schemaProblems.length)
    throw Error("AUTH_MIGRATION_UNSAFE");
  await migration.runMigrations();
  if (process.argv.includes("--init-admin")) {
    if (
      !(await client.query("SELECT 1 FROM mm_admin_setup WHERE singleton=true"))
        .rowCount
    ) {
      const token = randomBytes(32).toString("hex");
      await client.query(
        "INSERT INTO mm_admin_setup(singleton,token_hash,expires_at) VALUES(true,$1,now()+interval '7 days')",
        [createHash("sha256").update(token).digest("hex")],
      );
      await fs.writeFile(
        "/bootstrap/admin-initialisation.url",
        (process.env.NEWSLETTER_SITE_URL || "") +
          "/77774555474447777554555/initialiser#key=" +
          token,
        { mode: 0o600, flag: "wx" },
      );
      console.info(
        "Private initialization link saved in the protected bootstrap directory. No password defined.",
      );
    } else
      console.info(
        "Administrator initialization already prepared; existing state retained.",
      );
  }
  console.info("Migrations completed without altering existing orders.");
} catch {
  console.error("MIGRATION_FAILED");
  process.exitCode = 1;
} finally {
  await client
    .query("SELECT pg_advisory_unlock(hashtext('mm-migrations'))")
    .catch(() => {});
  client.release();
  await db.end();
}
