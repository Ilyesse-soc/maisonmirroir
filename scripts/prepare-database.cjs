// Creates application-only schemas and least-privilege roles in the newly provisioned dedicated database.
const fs = require("node:fs"),
  { randomBytes } = require("node:crypto"),
  { Pool } = require("pg");
const { connectionOptions } = require("../lib/databaseConnection.mjs");
process.loadEnvFile(".qa/env.production");
async function main() {
  const secretsFile = ".qa/runtime-secrets.json";
  if (fs.existsSync(secretsFile))
    throw Error(
      "Already prepared. Refusing to replace valid generated secrets.",
    );
  const ownerUrl = process.env.POSTGRES_URL_NON_POOLING;
  if (!ownerUrl) throw Error("Missing privileged session connection");
  const db = new Pool({ ...connectionOptions(ownerUrl), max: 1 });
  const secrets = {
    BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
    NEWSLETTER_HASH_SECRET: randomBytes(48).toString("hex"),
    CRON_SECRET: randomBytes(48).toString("hex"),
    NEWSLETTER_WORKER_SECRET: randomBytes(48).toString("hex"),
    ADMIN_BOOTSTRAP_PASSWORD: randomBytes(32).toString("base64url"),
  };
  const runtime = {};
  try {
    await db.query("BEGIN");
    for (const [environment, schema, role] of [
      ["production", "mm_live", "mm_live_app"],
      ["preview", "mm_preview", "mm_preview_app"],
    ]) {
      if (
        (await db.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role]))
          .rowCount
      )
        throw Error("Role already exists. Refusing to replace credentials.");
      const password = randomBytes(40).toString("hex");
      await db.query("CREATE SCHEMA " + schema);
      await db.query(
        "CREATE ROLE " +
          role +
          " LOGIN PASSWORD '" +
          password +
          "' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT",
      );
      await db.query(
        "ALTER ROLE " + role + " SET search_path TO " + schema + ",pg_catalog",
      );
      await db.query("GRANT CONNECT ON DATABASE postgres TO " + role);
      await db.query(
        "REVOKE ALL ON SCHEMA " + schema + " FROM PUBLIC,anon,authenticated",
      );
      await db.query("GRANT USAGE ON SCHEMA " + schema + " TO " + role);
      const url = new URL(ownerUrl),
        username = decodeURIComponent(url.username);
      url.username =
        role +
        (username.includes(".")
          ? "." + username.split(".").slice(1).join(".")
          : "");
      url.password = password;
      const migration = new URL(ownerUrl);
      migration.searchParams.set(
        "options",
        "-csearch_path=" + schema + ",pg_catalog",
      );
      runtime[environment] = {
        NEWSLETTER_DATABASE_URL: url.href,
        NEWSLETTER_MIGRATION_URL: migration.href,
        SCHEMA: schema,
        ROLE: role,
      };
    }
    await db.query("COMMIT");
    fs.writeFileSync(
      secretsFile,
      JSON.stringify({ secrets, runtime }, null, 2),
      { mode: 0o600 },
    );
    console.log(
      "Dedicated production and preview schemas and restricted login roles created. Secrets saved only in ignored local QA storage.",
    );
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error("Database preparation failed:", e.code || e.message);
  process.exitCode = 1;
});
