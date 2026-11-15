import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { OrderRecord } from "./orderTypes";
import { database, transaction } from "./newsletterDb";
const file = () =>
  process.env.ORDERS_FILE_PATH ||
  path.join(process.cwd(), "data", "orders.json");
const durable = () =>
  Boolean(
    process.env.NEWSLETTER_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.NODE_ENV === "production",
  );
export async function readOrders(): Promise<OrderRecord[]> {
  if (durable())
    return (
      await database().query(
        "SELECT record FROM mm_orders ORDER BY updated_at DESC",
      )
    ).rows.map((r) => r.record);
  // Local-only path; never trace arbitrary developer directories into a production function.
  const raw = await fs.readFile(/* turbopackIgnore: true */ file(), "utf8");
  const records = JSON.parse(raw);
  if (!Array.isArray(records)) throw Error("ORDERS_INVALID_DATA");
  return records;
}
export async function writeOrders(orders: OrderRecord[]) {
  if (durable()) {
    await transaction(async (db) => {
      for (const order of orders)
        await db.query(
          "INSERT INTO mm_orders(order_id,paypal_order_id,record) VALUES($1,$2,$3) ON CONFLICT(order_id) DO UPDATE SET record=$3,updated_at=now()",
          [order.orderId, order.paypalOrderId || null, JSON.stringify(order)],
        );
    });
    return;
  }
  const temporary = file() + "." + crypto.randomUUID() + ".tmp";
  await fs.writeFile(temporary, JSON.stringify(orders, null, 2), {
    mode: 0o600,
  });
  await fs.rename(temporary, file());
}
export async function saveOrder(order: OrderRecord) {
  if (durable()) {
    const inserted = await database().query(
      "INSERT INTO mm_orders(order_id,paypal_order_id,record) VALUES($1,$2,$3) ON CONFLICT(paypal_order_id) DO NOTHING RETURNING record",
      [order.orderId, order.paypalOrderId || null, JSON.stringify(order)],
    );
    if (!inserted.rowCount) throw Error("DUPLICATE_PAYMENT");
    return order;
  }
  const orders = await readOrders();
  if (
    order.paypalOrderId &&
    orders.some((o) => o.paypalOrderId === order.paypalOrderId)
  )
    throw Error("DUPLICATE_PAYMENT");
  await writeOrders([order, ...orders]);
  return order;
}
export async function updateOrder(id: string, patch: Partial<OrderRecord>) {
  if (durable())
    return transaction(async (db) => {
      const row = (
        await db.query(
          "SELECT record FROM mm_orders WHERE order_id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!row) return null;
      const updated = { ...row.record, ...patch };
      await db.query(
        "UPDATE mm_orders SET record=$2,updated_at=now() WHERE order_id=$1",
        [id, JSON.stringify(updated)],
      );
      return updated as OrderRecord;
    });
  const orders = await readOrders(),
    index = orders.findIndex((o) => o.orderId === id);
  if (index < 0) return null;
  orders[index] = { ...orders[index], ...patch };
  await writeOrders(orders);
  return orders[index];
}
