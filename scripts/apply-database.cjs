const fs = require("node:fs"),
  { Pool } = require("pg"),
  { spawnSync } = require("node:child_process");
const { connectionOptions } = require("../lib/databaseConnection.mjs");
const saved = JSON.parse(fs.readFileSync(".qa/runtime-secrets.json", "utf8"));
process.loadEnvFile(".qa/env.production");
async function main() {
  for (const [environment, settings] of Object.entries(saved.runtime)) {
    const expected = settings.SCHEMA;
    const pool = new Pool({
      ...connectionOptions(settings.NEWSLETTER_MIGRATION_URL),
      max: 1,
    });
    try {
      const schema = (await pool.query("SELECT current_schema() AS name"))
        .rows[0].name;
      if (schema !== expected) throw Error("Migration schema mismatch");
      const env = {
        ...process.env,
        ...saved.secrets,
        NEWSLETTER_DATABASE_URL: settings.NEWSLETTER_MIGRATION_URL,
        NEWSLETTER_MIGRATION_URL: settings.NEWSLETTER_MIGRATION_URL,
        BETTER_AUTH_URL: "https://maison-miroir.fr",
      };
      for (const script of [
        "scripts/newsletter-migrate.cjs",
        "scripts/setup-auth.mjs",
      ]) {
        const r = spawnSync(process.execPath, [script], {
          env,
          encoding: "utf8",
        });
        if (r.status !== 0) {
          console.error(r.stdout);
          let safe = r.stderr;
          for (const value of Object.values(env)) {
            if (typeof value === "string" && value.length > 8)
              safe = safe.split(value).join("[redacted]");
          }
          console.error(safe);
          throw Error("Migration failed");
        }
        console.log(environment, r.stdout.trim());
      }
      const role = settings.ROLE;
      await pool.query(
        "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA " +
          expected +
          " TO " +
          role,
      );
      await pool.query(
        "GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA " +
          expected +
          " TO " +
          role,
      );
      await pool.query(
        "REVOKE ALL ON ALL TABLES IN SCHEMA " +
          expected +
          " FROM anon,authenticated,PUBLIC",
      );
      await pool.query(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA " +
          expected +
          " REVOKE ALL ON TABLES FROM anon,authenticated,PUBLIC",
      );
      await pool.query(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA " +
          expected +
          " GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO " +
          role,
      );
    } finally {
      await pool.end();
    }
    const app = new Pool({
      ...connectionOptions(settings.NEWSLETTER_DATABASE_URL),
      max: 1,
    });
    try {
      const r = await app.query(
        "SELECT current_schema() AS name,(SELECT count(*) FROM mm_subscribers) AS subscribers",
      );
      if (r.rows[0].name !== expected) throw Error("App role schema mismatch");
      const privileges = (
        await app.query(
          "SELECT rolcreatedb,rolcreaterole,rolsuper FROM pg_roles WHERE rolname=current_user",
        )
      ).rows[0];
      if (
        privileges.rolsuper ||
        privileges.rolcreatedb ||
        privileges.rolcreaterole
      )
        throw Error("Excessive privileges");
      console.log(
        environment,
        "TLS connection, schema isolation and restricted privileges verified; subscribers:",
        r.rows[0].subscribers,
      );
    } finally {
      await app.end();
    }
  }
}
main().catch((e) => {
  console.error("Schema setup failed:", e.code || e.message);
  process.exitCode = 1;
});
