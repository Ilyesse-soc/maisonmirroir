import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type {
  MondialRelayShipment,
  OrderRecord,
} from "./orderTypes";
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

export async function reserveMondialRelayShipment(
  id: string,
  attemptId: string,
  reservedAt: string,
) {
  if (!durable()) throw Error("SHIPMENT_CREATION_REQUIRES_DATABASE");
  return transaction(async (db) => {
    const row = (
      await db.query(
        "SELECT record FROM mm_orders WHERE order_id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) return { status: "missing" as const };
    const order = row.record as OrderRecord;
    if (order.shipping.mondialRelayShipment)
      return { status: "already-reserved" as const };
    const shipment: MondialRelayShipment = {
      status: "creating",
      attemptId,
      reservedAt,
    };
    const updated: OrderRecord = {
      ...order,
      shipping: { ...order.shipping, mondialRelayShipment: shipment },
    };
    await db.query(
      "UPDATE mm_orders SET record=$2,updated_at=now() WHERE order_id=$1",
      [id, JSON.stringify(updated)],
    );
    return { status: "reserved" as const, order: updated };
  });
}

export async function finishMondialRelayShipment(
  id: string,
  attemptId: string,
  shipment: MondialRelayShipment,
) {
  if (!durable()) throw Error("SHIPMENT_CREATION_REQUIRES_DATABASE");
  return transaction(async (db) => {
    const row = (
      await db.query(
        "SELECT record FROM mm_orders WHERE order_id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) return null;
    const order = row.record as OrderRecord;
    if (
      order.shipping.mondialRelayShipment?.attemptId !== attemptId ||
      order.shipping.mondialRelayShipment.status !== "creating"
    )
      return null;
    const updated: OrderRecord = {
      ...order,
      shipping: { ...order.shipping, mondialRelayShipment: shipment },
      ...(shipment.shipmentNumber
        ? {
            trackingNumber: shipment.shipmentNumber,
            trackingUrl: order.shipping.trackingBaseUrl,
          }
        : {}),
    };
    await db.query(
      "UPDATE mm_orders SET record=$2,updated_at=now() WHERE order_id=$1",
      [id, JSON.stringify(updated)],
    );
    return updated;
  });
}

export async function reserveMondialRelayTrackingCheck(
  id: string,
  attemptId: string,
  checkedAt: string,
  minimumIntervalMs: number,
) {
  if (!durable()) throw Error("SHIPMENT_TRACKING_REQUIRES_DATABASE");
  return transaction(async (db) => {
    const row = (
      await db.query(
        "SELECT record FROM mm_orders WHERE order_id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) return { status: "missing" as const };
    const order = row.record as OrderRecord;
    const shipment = order.shipping.mondialRelayShipment;
    if (!shipment?.shipmentNumber)
      return { status: "shipment-missing" as const };
    const lastChecked = shipment.trackingCheckedAt
      ? Date.parse(shipment.trackingCheckedAt)
      : 0;
    const now = Date.parse(checkedAt);
    if (
      Number.isFinite(lastChecked) &&
      Number.isFinite(now) &&
      now - lastChecked < minimumIntervalMs
    )
      return { status: "cooldown" as const, order };
    const updatedShipment: MondialRelayShipment = {
      ...shipment,
      status: "tracking",
      trackingAttemptId: attemptId,
      trackingCheckedAt: checkedAt,
      trackingErrorCode: undefined,
    };
    const updated: OrderRecord = {
      ...order,
      shipping: {
        ...order.shipping,
        mondialRelayShipment: updatedShipment,
      },
    };
    await db.query(
      "UPDATE mm_orders SET record=$2,updated_at=now() WHERE order_id=$1",
      [id, JSON.stringify(updated)],
    );
    return { status: "reserved" as const, order: updated };
  });
}

export async function finishMondialRelayTrackingCheck(
  id: string,
  attemptId: string,
  patch: Partial<MondialRelayShipment>,
) {
  if (!durable()) throw Error("SHIPMENT_TRACKING_REQUIRES_DATABASE");
  return transaction(async (db) => {
    const row = (
      await db.query(
        "SELECT record FROM mm_orders WHERE order_id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) return null;
    const order = row.record as OrderRecord;
    const existing = order.shipping.mondialRelayShipment;
    if (
      existing?.trackingAttemptId !== attemptId ||
      existing.status !== "tracking"
    )
      return null;
    const updatedShipment = { ...existing, ...patch, status: "created" as const };
    const updated: OrderRecord = {
      ...order,
      shipping: {
        ...order.shipping,
        mondialRelayShipment: updatedShipment,
      },
    };
    await db.query(
      "UPDATE mm_orders SET record=$2,updated_at=now() WHERE order_id=$1",
      [id, JSON.stringify(updated)],
    );
    return updated;
  });
}
