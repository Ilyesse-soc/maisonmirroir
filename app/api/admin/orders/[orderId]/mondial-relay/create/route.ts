import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminAudit } from "@/lib/adminAudit";
import { adminDenied } from "@/lib/adminAuth";
import { createApi2ProductionShipment, MondialRelayApi2Error } from "@/lib/mondialRelayApi2";
import {
  finishMondialRelayShipment,
  readOrders,
  reserveMondialRelayShipment,
} from "@/lib/orderStore";
import { getMondialRelayProductionReadiness, getMondialRelaySettings } from "@/lib/mondialRelaySettings";
import { mutationAllowed } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";
import { MONDIAL_RELAY_POINT_RELAIS_ID } from "@/lib/shipping";
import type { ShipmentAddress } from "@/lib/mondialRelayApi2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const orderIdPattern = /^MM-[0-9]{4}-[A-Z0-9]{8}$/;
const streetPattern = /^\s*(\d+[A-Za-z]?(?:\s*(?:bis|ter|quater))?)\s+(.+?)\s*$/i;

function senderAddress(): ShipmentAddress | null {
  const firstName = process.env.MONDIAL_RELAY_SENDER_FIRSTNAME?.trim() || "";
  const lastName = process.env.MONDIAL_RELAY_SENDER_LASTNAME?.trim() || "";
  const street = process.env.MONDIAL_RELAY_SENDER_STREET?.trim() || "";
  const houseNo = process.env.MONDIAL_RELAY_SENDER_HOUSE_NO?.trim() || "";
  const postalCode = process.env.MONDIAL_RELAY_SENDER_POSTCODE?.trim() || "";
  const city = process.env.MONDIAL_RELAY_SENDER_CITY?.trim() || "";
  const country = process.env.MONDIAL_RELAY_SENDER_COUNTRY?.trim().toUpperCase();
  const phone = process.env.MONDIAL_RELAY_SENDER_PHONE?.trim() || "";
  const email = process.env.MONDIAL_RELAY_SENDER_EMAIL?.trim() || "";
  if (
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
    mobile: phone,
    email,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request, false);
  if (originDenied) return originDenied;
  try {
    const { orderId } = await context.params;
    if (!orderIdPattern.test(orderId))
      return NextResponse.json({ error: "ORDER_ID_INVALID" }, { status: 400 });
    const order = (await readOrders()).find((item) => item.orderId === orderId);
    if (!order)
      return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    if (!order.paypalOrderId || !["Payee", "En preparation"].includes(order.status))
      return NextResponse.json({ error: "ORDER_NOT_PAID" }, { status: 409 });
    if (order.shipping.id !== MONDIAL_RELAY_POINT_RELAIS_ID)
      return NextResponse.json(
        { error: "MONDIAL_RELAY_NOT_SELECTED" },
        { status: 409 },
      );
    const point = order.shipping.relayPoint;
    if (
      !point ||
      point.source !== "production" ||
      (point.serviceCode !== "24R/MED" && point.serviceCode !== "24R/APM")
    )
      return NextResponse.json(
        { error: "PRODUCTION_RELAY_POINT_REQUIRED" },
        { status: 409 },
      );

    await adminAudit("MONDIAL_RELAY_PRODUCTION_SHIPMENT_REQUESTED", orderId);
    const settings = await getMondialRelaySettings();
    const readiness = getMondialRelayProductionReadiness(settings);
    if (!readiness.shipmentCreationEnabled)
      return NextResponse.json(
        { error: "MONDIAL_RELAY_SHIPMENT_NOT_READY", readiness },
        { status: 503 },
      );
    if (
      point.serviceCode !== settings.serviceCode ||
      !settings.contractParcel.weightGrams ||
      !settings.contractParcel.lengthCm ||
      !settings.contractParcel.widthCm ||
      !settings.contractParcel.depthCm
    )
      return NextResponse.json(
        { error: "CONTRACT_SHIPMENT_PROFILE_MISMATCH" },
        { status: 409 },
      );
    const itemCount = order.items.reduce(
      (total, item) => total + item.quantity,
      0,
    );
    if (
      itemCount < 1 ||
      itemCount > settings.contractParcel.itemsPerParcel ||
      itemCount > 30
    )
      return NextResponse.json(
        { error: "CONTRACT_PARCEL_CAPACITY_EXCEEDED" },
        { status: 409 },
      );

    const recipientStreet = streetPattern.exec(order.customer.street);
    if (!recipientStreet)
      return NextResponse.json(
        { error: "CUSTOMER_ADDRESS_REQUIRES_HOUSE_NUMBER" },
        { status: 409 },
      );
    const sender = senderAddress();
    if (!sender)
      return NextResponse.json(
        { error: "MONDIAL_RELAY_SENDER_PROFILE_INVALID" },
        { status: 503 },
      );
    const attemptId = randomUUID();
    const reservation = await reserveMondialRelayShipment(
      orderId,
      attemptId,
      new Date().toISOString(),
    );
    if (reservation.status === "missing")
      return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    if (reservation.status === "already-reserved")
      return NextResponse.json(
        { error: "SHIPMENT_ALREADY_RESERVED" },
        { status: 409 },
      );

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
    try {
      const result = await createApi2ProductionShipment(
        {
          login: process.env.MONDIAL_RELAY_API2_PROD_LOGIN || "",
          password: process.env.MONDIAL_RELAY_API2_PROD_PASSWORD || "",
          customerId: process.env.MONDIAL_RELAY_API2_PROD_CUSTOMER_ID || "",
        },
        {
          orderNo: orderId,
          customerNo: orderId,
          serviceCode: point.serviceCode,
          relayLocation: point.location,
          collectionMode: process.env.MONDIAL_RELAY_COLLECTION_MODE || "",
          sender,
          recipient,
          parcels: [
            {
              content: order.items.map((item) => item.name).join(", ").slice(0, 60),
              weightGrams: settings.contractParcel.weightGrams,
              lengthCm: settings.contractParcel.lengthCm,
              widthCm: settings.contractParcel.widthCm,
              depthCm: settings.contractParcel.depthCm,
            },
          ],
        },
      );
      const shipment = await finishMondialRelayShipment(orderId, attemptId, {
        status: "created",
        attemptId,
        reservedAt: reservation.order.shipping.mondialRelayShipment!.reservedAt,
        shipmentNumber: result.shipmentNumber,
        labelUrl: result.labelUrl,
      });
      if (!shipment)
        return NextResponse.json(
          { error: "SHIPMENT_RESULT_REQUIRES_RECONCILIATION" },
          { status: 503 },
        );
      await adminAudit("MONDIAL_RELAY_PRODUCTION_SHIPMENT_CREATED", orderId);
      return NextResponse.json({
        status: "created",
        shipmentNumber: result.shipmentNumber,
      });
    } catch (error) {
      const errorCode =
        error instanceof MondialRelayApi2Error
          ? error.code
          : error instanceof Error
            ? error.message.replace(/[^A-Z0-9_-]/gi, "").slice(0, 80)
            : "UNKNOWN";
      await finishMondialRelayShipment(orderId, attemptId, {
        status: "unknown",
        attemptId,
        reservedAt: reservation.order.shipping.mondialRelayShipment!.reservedAt,
        ...(error instanceof MondialRelayApi2Error && error.shipmentNumber
          ? { shipmentNumber: error.shipmentNumber }
          : {}),
        providerErrorCode: errorCode,
      });
      securityEvent("MONDIAL_RELAY_PRODUCTION_SHIPMENT_FAILED", "warn");
      return NextResponse.json(
        {
          error: "SHIPMENT_RESULT_UNKNOWN",
          message:
            "Vérifiez l’état dans Mondial Relay avant toute nouvelle tentative. La protection anti-doublon reste verrouillée.",
        },
        { status: 502 },
      );
    }
  } catch {
    securityEvent("MONDIAL_RELAY_PRODUCTION_SHIPMENT_FAILED");
    return NextResponse.json(
      { error: "MONDIAL_RELAY_SHIPMENT_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
