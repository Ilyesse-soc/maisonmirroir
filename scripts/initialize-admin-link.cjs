const fs = require("node:fs"),
  crypto = require("node:crypto"),
  { Pool } = require("pg");
const { connectionOptions } = require("../lib/databaseConnection.mjs");
const config = JSON.parse(fs.readFileSync(".qa/runtime-secrets.json", "utf8"));
async function main() {
  config.setup ||= {};
  for (const [environment, runtime] of Object.entries(config.runtime)) {
    if (config.setup[environment]) continue;
    const db = new Pool({
      ...connectionOptions(runtime.NEWSLETTER_MIGRATION_URL),
      max: 1,
    });
    try {
      const existing = (
        await db.query(
          "SELECT claimed_at FROM mm_admin_setup WHERE singleton=true",
        )
      ).rows[0];
      if (existing)
        throw Error("Refusing to replace an existing initialization key");
      const token = crypto.randomBytes(32).toString("hex");
      await db.query(
        "INSERT INTO mm_admin_setup(singleton,token_hash,expires_at) VALUES(true,$1,now()+interval '7 days')",
        [crypto.createHash("sha256").update(token).digest("hex")],
      );
      config.setup[environment] = token;
      fs.writeFileSync(
        ".qa/runtime-secrets.json",
        JSON.stringify(config, null, 2),
        { mode: 0o600 },
      );
      console.log(
        environment,
        "private single-use setup key initialized; owner password remains undefined.",
      );
    } finally {
      await db.end();
    }
  }
}
main().catch((error) => {
  console.error("Admin initialization failed:", error.code || error.message);
  process.exitCode = 1;
});
