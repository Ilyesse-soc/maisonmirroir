import "server-only";
import { Pool, PoolClient } from "pg";
import { connectionOptions } from "./databaseConnection.mjs";
let pool: Pool | undefined;
export function database() {
  const connectionString =
    process.env.NEWSLETTER_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
  const options = connectionOptions(connectionString);
  if (!pool) {
    pool = new Pool({
      ...options,
      max: Math.max(2, Math.min(5, Number(process.env.DATABASE_POOL_MAX) || 3)),
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 20000,
      query_timeout: 15000,
      statement_timeout: 15000,
      application_name: "maison-miroir",
    });
    pool.on("error", () =>
      console.error('{"code":"DATABASE_POOL_ERROR","level":"error"}'),
    );
  }
  return pool;
}
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
