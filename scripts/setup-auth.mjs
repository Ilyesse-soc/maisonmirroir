import fs from "node:fs/promises";
import { Pool } from "pg";
import { connectionOptions } from "../lib/databaseConnection.mjs";
import { getMigrations } from "better-auth/db/migration";
import { makeAuth } from "../lib/authConfiguration.ts";
if (process.env.MM_ENV_FILE) process.loadEnvFile(process.env.MM_ENV_FILE);
else (await import("@next/env")).default.loadEnvConfig(process.cwd());
const pool = new Pool({
  ...connectionOptions(
    process.env.NEWSLETTER_DATABASE_URL || process.env.DATABASE_URL,
  ),
  max: 1,
});
try {
  const auth = makeAuth(pool, process.argv.includes("--bootstrap"));
  const migration = await getMigrations(auth.options, { throwOnUnsafe: true });
  if (migration.unsafeChanges.length || migration.schemaProblems.length)
    throw Error("Unsafe auth migration");
  await migration.runMigrations();
  console.log("Authentication schema ready.");
  if (process.argv.includes("--bootstrap")) {
    const email = (
      process.env.ADMIN_EMAIL ||
      process.env.EMAIL_ADMIN ||
      process.env.OWNER_EMAIL ||
      ""
    )
      .trim()
      .toLowerCase();
    if (!email || !process.env.ADMIN_BOOTSTRAP_PASSWORD)
      throw Error("Bootstrap credentials required");
    const existing = await pool.query(
      "SELECT id FROM mm_auth_user WHERE email=$1",
      [email],
    );
    if (existing.rowCount)
      throw Error("Admin already exists; password not changed");
    await auth.api.signUpEmail({
      body: {
        name: "Maison Miroir",
        email,
        password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
      },
    });
    console.log("Administrator created. Public registration remains disabled.");
  }
} catch (error) {
  console.error("Authentication setup failed:", error.code || error.name);
  process.exitCode = 1;
} finally {
  await pool.end();
}
