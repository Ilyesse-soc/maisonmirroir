const { Pool } = require("pg");
require("@next/env").loadEnvConfig(process.cwd());
async function main() {
  const days = Number(process.env.NEWSLETTER_RETENTION_DAYS || 730);
  if (!Number.isInteger(days) || days < 1) throw Error("Invalid retention");
  if (!process.env.NEWSLETTER_DATABASE_URL) throw Error("Database required");
  const db = new Pool({
    connectionString: process.env.NEWSLETTER_DATABASE_URL,
  });
  try {
    const r = await db.query(
      `DELETE FROM mm_subscribers WHERE (status='pending' AND consent_at<now()-interval '30 days') OR (status IN ('unsubscribed','suppressed') AND unsubscribed_at<now()-($1 * interval '1 day'))`,
      [days],
    );
    await db.query("DELETE FROM mm_rate_limits WHERE expires_at<now()");
    console.log("Expired subscriber records removed:", r.rowCount);
  } finally {
    await db.end();
  }
}
main().catch(() => {
  console.error("Retention failed; check database configuration.");
  process.exitCode = 1;
});
