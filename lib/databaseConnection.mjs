import fs from "node:fs";
import path from "node:path";
export function connectionOptions(connectionString) {
  const url = new URL(connectionString);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    !local &&
    ["disable", "allow", "prefer", "no-verify"].includes(
      url.searchParams.get("sslmode"),
    )
  )
    throw Error("DATABASE_INSECURE_TLS");
  for (const key of [
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "uselibpqcompat",
  ])
    url.searchParams.delete(key);
  const schema = url.searchParams.get("mm_schema");
  url.searchParams.delete("mm_schema");
  if (schema && !/^mm_(live|preview)$/.test(schema))
    throw Error("INVALID_SCHEMA");
  const ssl = local
    ? false
    : {
        rejectUnauthorized: true,
        ...(url.hostname.endsWith(".supabase.com") ||
        url.hostname.endsWith(".supabase.co")
          ? {
              ca: fs.readFileSync(
                path.join(process.cwd(), "certificates", "supabase-ca.crt"),
                "utf8",
              ),
            }
          : {}),
      };
  if (!local && process.env.DATABASE_CA_FILE) {
    ssl.ca = fs.readFileSync(
      /* turbopackIgnore: true */ process.env.DATABASE_CA_FILE,
      "utf8",
    );
  }
  return {
    connectionString: url.href,
    ssl,
    ...(schema
      ? {
          onConnect: async (client) => {
            await client.query("SET search_path TO " + schema + ",pg_catalog");
          },
        }
      : {}),
  };
}
