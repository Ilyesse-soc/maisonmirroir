import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "fs";
import path from "path";
import type {
  MondialRelayShipment,
  OrderRecord,
  OrderStatus,
} from "./orderTypes";
import { database, transaction } from "./newsletterDb";
import { MONDIAL_RELAY_POINT_RELAIS_ID } from "./shipping";
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
export async function readOrdersDueForTracking(limit = 3): Promise<OrderRecord[]> {
  if (!durable()) return [];
  return (
    await database().query(
      `SELECT record FROM mm_orders
        WHERE record #>> '{shipping,mondialRelayShipment,shipmentNumber}' IS NOT NULL
          AND (
            record #>> '{shipping,mondialRelayShipment,trackingCheckedAt}' IS NULL
            OR (record #>> '{shipping,mondialRelayShipment,trackingCheckedAt}')::timestamptz
              < now()-interval '6 hours'
          )
        ORDER BY updated_at ASC
        LIMIT $1`,
      [Math.max(1, Math.min(20, limit))],
    )
  ).rows.map((row) => row.record as OrderRecord);
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

export async function syncMondialRelayOrderStatus(
  id: string,
  status: Extract<
    OrderStatus,
    | "Deposee chez Mondial Relay"
    | "En transit"
    | "Disponible en Point Relais"
    | "Livree"
    | "Retournee"
  >,
) {
  if (!durable()) throw Error("SHIPMENT_TRACKING_REQUIRES_DATABASE");
  const statusToShipment: Record<string, string> = {
    "Deposee chez Mondial Relay": "shipped",
    "En transit": "shipped",
    "Disponible en Point Relais": "shipped",
    Livree: "delivered",
    Retournee: "returned",
  };
  const rank: Record<string, number> = {
    Payee: 0,
    "En preparation": 1,
    "Prete a expedier": 2,
    Expediee: 3,
    "Deposee chez Mondial Relay": 3,
    "En transit": 4,
    "Disponible en Point Relais": 5,
    Livree: 6,
    Retournee: 7,
  };
  return transaction(async (db) => {
    const row = (
      await db.query(
        "SELECT record FROM mm_orders WHERE order_id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) return null;
    const order = row.record as OrderRecord;
    const finance = (
      await db.query(
        "SELECT payment_status FROM mm_commerce_order_financials WHERE order_id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!["paid", "partially_refunded"].includes(String(finance?.payment_status)))
      return order;
    if (
      (rank[order.status] ?? -1) >= rank[status] ||
      order.status === "Annulee"
    )
      return order;
    const updated: OrderRecord = { ...order, status };
    await db.query(
      "UPDATE mm_orders SET record=$2,updated_at=now() WHERE order_id=$1",
      [id, JSON.stringify(updated)],
    );
    await db.query(
      "UPDATE mm_commerce_order_financials SET shipment_status=$2,updated_at=now() WHERE order_id=$1",
      [id, statusToShipment[status]],
    );
    return updated;
  });
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
    if (
      order.shipping.mondialRelayShipment &&
      order.shipping.mondialRelayShipment.status !== "failed"
    )
      return { status: "already-reserved" as const };
    const shipment: MondialRelayShipment = {
      status: "creating",
      source: "api2",
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

export async function claimMondialRelayShipmentJob(orderId?: string) {
  if (!durable()) throw Error("SHIPMENT_QUEUE_REQUIRES_DATABASE");
  return (
    await database().query(
      `UPDATE mm_mondial_relay_shipment_jobs
          SET status='processing', attempts=attempts+1, leased_at=now(),
              updated_at=now()
        WHERE order_id=(
          SELECT order_id
            FROM mm_mondial_relay_shipment_jobs
           WHERE ($1::text IS NULL OR order_id=$1)
             AND ((status='queued' AND next_attempt_at<=now())
              OR (status='processing' AND leased_at<now()-interval '5 minutes'))
           ORDER BY next_attempt_at, created_at
           FOR UPDATE SKIP LOCKED
           LIMIT 1
        )
        RETURNING order_id, attempts`,
      [orderId || null],
    )
  ).rows[0] as { order_id: string; attempts: number } | undefined;
}

export async function finishMondialRelayShipmentJob(
  orderId: string,
  status: "completed" | "failed" | "unknown",
  errorCode?: string,
) {
  if (!durable()) throw Error("SHIPMENT_QUEUE_REQUIRES_DATABASE");
  await database().query(
    `UPDATE mm_mondial_relay_shipment_jobs
        SET status=$2, error_code=$3, leased_at=NULL, updated_at=now()
      WHERE order_id=$1 AND status='processing'`,
    [orderId, status, errorCode || null],
  );
}

export async function retryMondialRelayShipmentJob(orderId: string) {
  if (!durable()) throw Error("SHIPMENT_QUEUE_REQUIRES_DATABASE");
  const result = await database().query(
    `UPDATE mm_mondial_relay_shipment_jobs
        SET status='queued', next_attempt_at=now(), error_code=NULL,
            leased_at=NULL, updated_at=now()
      WHERE order_id=$1 AND status='failed'
      RETURNING order_id`,
    [orderId],
  );
  return result.rowCount === 1;
}

export async function registerManualMondialRelayShipment(
  orderId: string,
  shipmentNumber: string,
) {
  if (!durable()) throw Error("MANUAL_SHIPMENT_REQUIRES_DATABASE");
  return transaction(async (db) => {
    const row = (
      await db.query("SELECT record FROM mm_orders WHERE order_id=$1 FOR UPDATE", [
        orderId,
      ])
    ).rows[0];
    if (!row) throw Error("ORDER_NOT_FOUND");
    const order = row.record as OrderRecord;
    if (order.shipping.id !== MONDIAL_RELAY_POINT_RELAIS_ID)
      throw Error("MANUAL_SHIPMENT_RELAY_REQUIRED");

    const finance = (
      await db.query(
        `SELECT payment_status,shipment_status
           FROM mm_commerce_order_financials
          WHERE order_id=$1
          FOR UPDATE`,
        [orderId],
      )
    ).rows[0];
    if (finance?.payment_status !== "paid")
      throw Error("MANUAL_SHIPMENT_ORDER_NOT_PAID");

    const currentShipment = order.shipping.mondialRelayShipment;
    if (
      currentShipment?.source === "connect_manual" &&
      currentShipment.shipmentNumber === shipmentNumber
    )
      return order;
    if (currentShipment && currentShipment.status !== "failed")
      throw Error("SHIPMENT_ALREADY_EXISTS");
    if (!["unfulfilled", "preparing", "ready"].includes(
      String(finance.shipment_status),
    ))
      throw Error("ORDER_NOT_READY_FOR_MANUAL_SHIPMENT");

    const job = (
      await db.query(
        `SELECT status
           FROM mm_mondial_relay_shipment_jobs
          WHERE order_id=$1
          FOR UPDATE`,
        [orderId],
      )
    ).rows[0];
    if (job?.status === "processing" || job?.status === "unknown" || job?.status === "completed")
      throw Error("AUTOMATIC_SHIPMENT_REQUIRES_RECONCILIATION");

    const duplicate = (
      await db.query(
        `SELECT order_id
           FROM mm_orders
          WHERE order_id<>$1
            AND (record->>'trackingNumber'=$2
              OR record #>> '{shipping,mondialRelayShipment,shipmentNumber}'=$2)
          LIMIT 1`,
        [orderId, shipmentNumber],
      )
    ).rows[0];
    if (duplicate) throw Error("SHIPMENT_NUMBER_ALREADY_REGISTERED");

    const reservedAt = new Date().toISOString();
    const shipment = {
      status: "created" as const,
      source: "connect_manual" as const,
      attemptId: `manual-${randomUUID()}`,
      reservedAt,
      shipmentNumber,
      labelAvailable: false,
    };
    const updated: OrderRecord = {
      ...order,
      status: "Prete a expedier",
      trackingNumber: shipmentNumber,
      trackingUrl: order.shipping.trackingBaseUrl,
      shipping: {
        ...order.shipping,
        fulfillmentMode: "manual_connect",
        mondialRelayShipment: shipment,
      },
    };
    await db.query(
      "UPDATE mm_orders SET record=$2,updated_at=now() WHERE order_id=$1",
      [orderId, JSON.stringify(updated)],
    );
    await db.query(
      `UPDATE mm_commerce_order_financials
          SET shipment_status='ready',updated_at=now()
        WHERE order_id=$1`,
      [orderId],
    );
    if (job?.status === "queued" || job?.status === "failed")
      await db.query(
        `UPDATE mm_mondial_relay_shipment_jobs
            SET status='completed',error_code=NULL,leased_at=NULL,updated_at=now()
          WHERE order_id=$1 AND status IN ('queued','failed')`,
        [orderId],
      );
    return updated;
  });
}

export async function finishMondialRelayShipment(
  id: string,
  attemptId: string,
  shipment: MondialRelayShipment,
  labelPdf?: Buffer,
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
    const updatedShipment: MondialRelayShipment = {
      ...shipment,
      labelAvailable: Boolean(labelPdf),
    };
    const updated: OrderRecord = {
      ...order,
      shipping: {
        ...order.shipping,
        mondialRelayShipment: updatedShipment,
      },
      ...(updatedShipment.shipmentNumber
        ? {
            trackingNumber: updatedShipment.shipmentNumber,
            trackingUrl: order.shipping.trackingBaseUrl,
          }
        : {}),
    };
    if (labelPdf)
      await db.query(
        `INSERT INTO mm_mondial_relay_shipment_labels(order_id,pdf)
         VALUES($1,$2)
         ON CONFLICT(order_id) DO UPDATE SET pdf=$2,updated_at=now()`,
        [id, labelPdf],
      );
    await db.query(
      "UPDATE mm_orders SET record=$2,updated_at=now() WHERE order_id=$1",
      [id, JSON.stringify(updated)],
    );
    return updated;
  });
}

export async function saveMondialRelayShipmentLabel(
  id: string,
  shipmentNumber: string,
  labelPdf: Buffer,
) {
  if (!durable()) throw Error("SHIPMENT_LABEL_REQUIRES_DATABASE");
  return transaction(async (db) => {
    const row = (
      await db.query(
        "SELECT record FROM mm_orders WHERE order_id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) return null;
    const order = row.record as OrderRecord;
    const shipment = order.shipping.mondialRelayShipment;
    if (
      shipment?.status !== "created" ||
      shipment.shipmentNumber !== shipmentNumber ||
      !shipment.labelUrl
    )
      return null;
    await db.query(
      `INSERT INTO mm_mondial_relay_shipment_labels(order_id,pdf)
       VALUES($1,$2)
       ON CONFLICT(order_id) DO UPDATE SET pdf=$2,updated_at=now()`,
      [id, labelPdf],
    );
    const updated: OrderRecord = {
      ...order,
      shipping: {
        ...order.shipping,
        mondialRelayShipment: { ...shipment, labelAvailable: true },
      },
    };
    await db.query(
      "UPDATE mm_orders SET record=$2,updated_at=now() WHERE order_id=$1",
      [id, JSON.stringify(updated)],
    );
    return updated;
  });
}

export async function readMondialRelayShipmentLabel(id: string) {
  if (!durable()) throw Error("SHIPMENT_LABEL_REQUIRES_DATABASE");
  const row = (
    await database().query(
      "SELECT pdf FROM mm_mondial_relay_shipment_labels WHERE order_id=$1",
      [id],
    )
  ).rows[0];
  return row ? Buffer.from(row.pdf) : null;
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
