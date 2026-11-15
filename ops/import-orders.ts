// Offline, explicit import only. No email/payment/provider modules are imported here.
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { connectionOptions } from "../lib/databaseConnection.mjs";
const file = process.env.IMPORT_SOURCE_FILE,
  manifestFile = process.env.IMPORT_MANIFEST_FILE,
  reportFile = process.env.IMPORT_REPORT_FILE;
if (!file || !manifestFile || !reportFile)
  throw Error("SOURCE_MANIFEST_AND_REPORT_REQUIRED");
const raw = await fs.readFile(file);
if (raw.length > 50 * 1024 * 1024)
  throw Error("SOURCE_REQUIRES_A_STREAMED_IMPORT_PLAN");
const checksum = createHash("sha256").update(raw).digest("hex"),
  manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
if (
  manifest.sha256 !== checksum ||
  manifest.complete !== true ||
  manifest.backupVerified !== true ||
  !manifest.sourceSystem ||
  !manifest.capturedAt
)
  throw Error("COMPLETE_VERIFIED_SOURCE_BACKUP_REQUIRED");
const records = JSON.parse(raw.toString("utf8"));
if (!Array.isArray(records) || manifest.sourceCount !== records.length)
  throw Error("SOURCE_COUNT_MISMATCH");
const ids = new Set<string>();
let clients = new Set<string>(),
  articles = 0,
  totalCents = 0;
function money(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw Error("INVALID_AMOUNT");
  return Math.round(value * 100);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
for (const row of records) {
  if (
    !row ||
    typeof row.orderId !== "string" ||
    !/^MM-[0-9]{4}-[A-Z0-9]{8}$/.test(row.orderId) ||
    ids.has(row.orderId) ||
    !row.customer ||
    typeof row.customer.email !== "string" ||
    !Array.isArray(row.items) ||
    !row.items.length
  )
    throw Error("ORDER_ID_CUSTOMER_OR_ITEMS_INVALID");
  if (!Number.isFinite(Date.parse(row.orderDate)))
    throw Error("INVALID_ORDER_DATE");
  ids.add(row.orderId);
  clients.add(row.customer.email.trim().toLowerCase());
  let subtotal = 0;
  for (const item of row.items) {
    if (
      !item ||
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    )
      throw Error("ITEM_INVALID");
    subtotal += money(item.unitPrice) * item.quantity;
    articles += item.quantity;
  }
  if (
    subtotal !== money(row.subtotal) ||
    subtotal + money(row.shipping?.price) !== money(row.total)
  )
    throw Error("ORDER_AMOUNT_INTEGRITY_FAILED");
  totalCents += money(row.total);
}
const commit = process.argv.includes("--commit"),
  url = process.env.IMPORT_DATABASE_URL;
if (!url) throw Error("IMPORT_DATABASE_URL_REQUIRED");
const databaseName = new URL(url).pathname;
if (!commit && !/^\/maison_miroir_import$/.test(databaseName))
  throw Error("ISOLATED_IMPORT_DATABASE_REQUIRED");
if (commit) {
  if (databaseName !== "/maison_miroir")
    throw Error("PRODUCTION_TARGET_MISMATCH");
  const stage = JSON.parse(
    await fs.readFile(process.env.IMPORT_STAGE_REPORT || "", "utf8"),
  );
  if (
    !stage.passed ||
    stage.sourceSha256 !== checksum ||
    stage.orders !== records.length ||
    stage.totalCents !== totalCents
  )
    throw Error("VERIFIED_ISOLATED_IMPORT_REQUIRED");
}
const pool = new Pool({ ...connectionOptions(url), max: 1 }),
  client = await pool.connect();
let inserted = 0,
  unchanged = 0;
try {
  await client.query("BEGIN");
  for (const row of records) {
    const existing = (
      await client.query(
        "SELECT record FROM mm_orders WHERE order_id=$1 FOR UPDATE",
        [row.orderId],
      )
    ).rows[0];
    if (existing) {
      if (canonical(existing.record) !== canonical(row))
        throw Error("EXISTING_ORDER_DIFFERS_IMPORT_STOPPED");
      unchanged++;
      continue;
    }
    await client.query(
      "INSERT INTO mm_orders(order_id,paypal_order_id,record) VALUES($1,$2,$3)",
      [row.orderId, row.paypalOrderId || null, JSON.stringify(row)],
    );
    inserted++;
  }
  const actual = await client.query(
    "SELECT order_id,record FROM mm_orders WHERE order_id=ANY($1::text[])",
    [[...ids]],
  );
  if (actual.rowCount !== records.length) throw Error("TARGET_COUNT_MISMATCH");
  const originals = new Map(
    records.map((row) => [row.orderId, canonical(row)]),
  );
  if (
    actual.rows.some(
      (row) => originals.get(row.order_id) !== canonical(row.record),
    )
  )
    throw Error("TARGET_DATA_DIFFERS");
  await client.query("COMMIT");
  await fs.writeFile(
    reportFile,
    JSON.stringify(
      {
        passed: true,
        stage: commit ? "final" : "isolated",
        sourceSha256: checksum,
        orders: records.length,
        clients: clients.size,
        articles,
        totalCents,
        inserted,
        unchanged,
        errors: 0,
        differences: 0,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
  console.info(
    JSON.stringify({
      code: "IMPORT_INTEGRITY_VERIFIED",
      orders: records.length,
      inserted,
      unchanged,
      errors: 0,
      differences: 0,
    }),
  );
} catch {
  await client.query("ROLLBACK");
  console.error("IMPORT_FAILED_NO_PARTIAL_CHANGES");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
