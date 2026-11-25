import "server-only";
import { database } from "@/lib/newsletterDb";
import {
  createApi2ProductionShipment,
  downloadApi2ProductionLabel,
  MondialRelayApi2Error,
} from "@/lib/mondialRelayApi2";
import {
  finishMondialRelayShipment,
  readOrders,
  reserveMondialRelayShipment,
  saveMondialRelayShipmentLabel,
} from "@/lib/orderStore";
import {
  getMondialRelayProductionReadiness,
  getMondialRelaySettings,
} from "@/lib/mondialRelaySettings";
import {
  MONDIAL_RELAY_HOME_ID,
  MONDIAL_RELAY_POINT_RELAIS_ID,
} from "@/lib/shipping";
import {
  getHomeDeliveryParcelProfile,
  getMondialRelayParcelProfile,
  isMondialRelayServiceAllowed,
} from "@/lib/mondialRelayTypes";
import type { ShipmentAddress } from "@/lib/mondialRelayApi2";

const orderIdPattern = /^MM-[0-9]{4}-[A-Z0-9]{8}$/;
const streetPattern = /^\s*(\d+[A-Za-z]?(?:\s*(?:bis|ter|quater))?)\s+(.+?)\s*$/i;

export class ShipmentCreationError extends Error {
  constructor(
    readonly code: string,
    readonly outcome: "failed" | "unknown",
    readonly httpStatus: number,
  ) {
    super(code);
  }
}

function senderAddress(
  sender: Awaited<ReturnType<typeof getMondialRelaySettings>>["sender"],
): ShipmentAddress | null {
  const firstName = sender.firstName.trim();
  const lastName = sender.lastName.trim();
  const street = sender.street.trim();
  const houseNo = sender.houseNo.trim();
  const postalCode = sender.postalCode.trim();
  const city = sender.city.trim();
  const country = sender.countryCode.trim().toUpperCase();
  const phone = sender.phone.trim();
  const email = sender.email.trim();
  if (
    !sender.company.trim() ||
    !firstName ||
    !lastName ||
    !street ||
    !houseNo ||
    !/^[0-9]{5}$/.test(postalCode) ||
    !city ||
    country !== "FR" ||
    !phone ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    return null;
  return {
    firstName,
    lastName,
    street,
    houseNo,
    countryCode: "FR",
    postalCode,
    city,
    addressAdd1: sender.company.trim(),
    mobile: phone,
    email,
  };
}

function creationError(code: string, outcome: "failed" | "unknown", httpStatus: number): never {
  throw new ShipmentCreationError(code, outcome, httpStatus);
}

export async function createProductionShipment(orderId: string) {
  if (!orderIdPattern.test(orderId))
    creationError("ORDER_ID_INVALID", "failed", 400);
  const order = (await readOrders()).find((item) => item.orderId === orderId);
  if (!order) creationError("ORDER_NOT_FOUND", "failed", 404);
  const payment = await database().query(
    "SELECT payment_status FROM mm_commerce_order_financials WHERE order_id=$1",
    [orderId],
  );
  if (payment.rows[0]?.payment_status !== "paid")
    creationError("ORDER_NOT_PAID", "failed", 409);

  const isRelay = order.shipping.id === MONDIAL_RELAY_POINT_RELAIS_ID;
  const isHome = order.shipping.id === MONDIAL_RELAY_HOME_ID;
  if (!isRelay && !isHome)
    creationError("MONDIAL_RELAY_NOT_SELECTED", "failed", 409);
  const point = order.shipping.relayPoint;
  if (
    order.shipping.mondialRelayShipment?.source === "connect_manual"
  )
    creationError("MANUAL_CONNECT_SHIPMENT_ALREADY_REGISTERED", "failed", 409);
  if (
    isRelay &&
    (!point ||
      point.source !== "production" ||
      !["24R/MED", "24R/APM"].includes(point.serviceCode))
  )
    creationError("PRODUCTION_RELAY_POINT_REQUIRED", "failed", 409);

  if (order.shipping.mondialRelayShipment?.status === "created") {
    const shipment = order.shipping.mondialRelayShipment;
    if (shipment.labelAvailable)
      return {
        status: "created" as const,
        shipmentNumber: shipment.shipmentNumber || "",
      };
    if (!shipment.shipmentNumber || !shipment.labelUrl)
      creationError("SHIPMENT_RESULT_UNKNOWN", "unknown", 409);
    try {
      const labelPdf = await downloadApi2ProductionLabel(shipment.labelUrl);
      const updated = await saveMondialRelayShipmentLabel(
        orderId,
        shipment.shipmentNumber,
        labelPdf,
      );
      if (!updated)
        creationError("SHIPMENT_RESULT_REQUIRES_RECONCILIATION", "unknown", 503);
      return {
        status: "created" as const,
        shipmentNumber: shipment.shipmentNumber,
      };
    } catch (error) {
      if (error instanceof ShipmentCreationError) throw error;
      creationError("LABEL_DOWNLOAD_FAILED", "failed", 502);
    }
  }
  if (
    order.shipping.mondialRelayShipment &&
    order.shipping.mondialRelayShipment.status !== "failed"
  )
    creationError("SHIPMENT_RESULT_UNKNOWN", "unknown", 409);

  const settings = await getMondialRelaySettings();
  if (settings.fulfillmentMode !== "api2")
    creationError("API2_FULFILLMENT_MODE_NOT_SELECTED", "failed", 409);
  const readiness = getMondialRelayProductionReadiness(settings);
  if (
    isRelay
      ? !readiness.shipmentCreationEnabled
      : !readiness.homeShipmentCreationReady
  )
    creationError("MONDIAL_RELAY_SHIPMENT_NOT_READY", "failed", 503);
  const itemCount = order.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const parcel = isRelay
    ? getMondialRelayParcelProfile(settings, itemCount)
    : getHomeDeliveryParcelProfile(settings, itemCount);
  if (
    (isRelay &&
      (!point ||
        !isMondialRelayServiceAllowed(settings, point.serviceCode) ||
        point.serviceCode !== settings.serviceCode)) ||
    !parcel
  )
    creationError("CONTRACT_SHIPMENT_PROFILE_MISMATCH", "failed", 409);
  if (itemCount < 1 || itemCount > 30)
    creationError("CONTRACT_PARCEL_CAPACITY_EXCEEDED", "failed", 409);

  const recipientStreet = streetPattern.exec(order.customer.street);
  if (!recipientStreet)
    creationError("CUSTOMER_ADDRESS_REQUIRES_HOUSE_NUMBER", "failed", 409);
  const sender = senderAddress(settings.sender);
  if (!sender)
    creationError("MONDIAL_RELAY_SENDER_PROFILE_INVALID", "failed", 503);

  const attemptId = crypto.randomUUID();
  const reservation = await reserveMondialRelayShipment(
    orderId,
    attemptId,
    new Date().toISOString(),
  );
  if (reservation.status === "missing")
    creationError("ORDER_NOT_FOUND", "failed", 404);
  if (reservation.status === "already-reserved")
    creationError("SHIPMENT_RESULT_UNKNOWN", "unknown", 409);
  const reservedAt =
    reservation.order.shipping.mondialRelayShipment?.reservedAt ||
    new Date().toISOString();
  const recipient: ShipmentAddress = {
    firstName: order.customer.firstName,
    lastName: order.customer.lastName,
    street: recipientStreet[2],
    houseNo: recipientStreet[1],
    countryCode: "FR",
    postalCode: order.customer.zip,
    city: order.customer.city,
    phone: order.customer.phone,
    mobile: order.customer.phone,
    email: order.customer.email,
  };

  let createdResult: { shipmentNumber: string; labelUrl: string } | null = null;
  try {
    createdResult = await createApi2ProductionShipment(
      {
        login: process.env.MONDIAL_RELAY_API2_PROD_LOGIN || "",
        password: process.env.MONDIAL_RELAY_API2_PROD_PASSWORD || "",
        customerId: process.env.MONDIAL_RELAY_API2_PROD_CUSTOMER_ID || "",
      },
      {
        orderNo: orderId,
        customerNo: orderId,
        deliveryMode: isHome ? "HOM" : "24R",
        ...(isRelay && point ? { relayLocation: point.location } : {}),
        collectionMode: settings.collectionMode,
        sender,
        recipient,
        parcels: [
          {
            content: order.items.map((item) => item.name).join(", ").slice(0, 60),
            weightGrams: parcel.weightGrams,
            lengthCm: parcel.lengthCm,
            widthCm: parcel.widthCm,
            depthCm: parcel.depthCm,
          },
        ],
      },
    );
    const labelPdf = await downloadApi2ProductionLabel(createdResult.labelUrl);
    const updated = await finishMondialRelayShipment(orderId, attemptId, {
      status: "created",
      source: "api2",
      attemptId,
      reservedAt,
      shipmentNumber: createdResult.shipmentNumber,
      labelUrl: createdResult.labelUrl,
    }, labelPdf);
    if (!updated)
      creationError("SHIPMENT_RESULT_REQUIRES_RECONCILIATION", "unknown", 503);
    return {
      status: "created" as const,
      shipmentNumber: createdResult.shipmentNumber,
    };
  } catch (error) {
    if (error instanceof ShipmentCreationError) throw error;
    if (createdResult) {
      const stored = await finishMondialRelayShipment(orderId, attemptId, {
        status: "created",
        source: "api2",
        attemptId,
        reservedAt,
        shipmentNumber: createdResult.shipmentNumber,
        labelUrl: createdResult.labelUrl,
        providerErrorCode: "LABEL_DOWNLOAD_FAILED",
      });
      if (!stored)
        creationError("SHIPMENT_RESULT_REQUIRES_RECONCILIATION", "unknown", 503);
      creationError("LABEL_DOWNLOAD_FAILED", "failed", 502);
    }
    const definitiveRejection =
      error instanceof MondialRelayApi2Error &&
      error.code.startsWith("PROVIDER_") &&
      !error.shipmentNumber;
    const errorCode =
      error instanceof MondialRelayApi2Error
        ? error.code
        : error instanceof Error
          ? error.message.replace(/[^A-Z0-9_-]/gi, "").slice(0, 80)
          : "UNKNOWN";
    await finishMondialRelayShipment(orderId, attemptId, {
      status: definitiveRejection ? "failed" : "unknown",
      source: "api2",
      attemptId,
      reservedAt,
      ...(error instanceof MondialRelayApi2Error && error.shipmentNumber
        ? { shipmentNumber: error.shipmentNumber }
        : {}),
      providerErrorCode: errorCode,
    });
    creationError(
      definitiveRejection ? "SHIPMENT_CREATION_FAILED" : "SHIPMENT_RESULT_UNKNOWN",
      definitiveRejection ? "failed" : "unknown",
      502,
    );
  }
}
