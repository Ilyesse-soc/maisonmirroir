import "server-only";
import { canonicalCommerceItems } from "@/lib/commerceInventory";
import {
  getMondialRelayProductionReadiness,
  getMondialRelaySettings,
} from "@/lib/mondialRelaySettings";
import { verifyMondialRelayPointProof, withoutMondialRelayPointProof } from "@/lib/mondialRelayPointProof";
import {
  getHomeDeliveryPriceCents,
  getMondialRelayQuote,
  type RelayPoint,
} from "@/lib/mondialRelayTypes";
import {
  getShippingMethodById,
  MONDIAL_RELAY_HOME_ID,
  MONDIAL_RELAY_POINT_RELAIS_ID,
} from "@/lib/shipping";
import type { OrderPayload, ProductInfo } from "@/lib/orderTypes";
import { getCgvVersion } from "@/lib/legalVersion";

type CheckoutPayload = OrderPayload & {
  shipping?: { id?: string };
  promotionCode?: string;
  acceptTerms?: boolean;
  cgvVersion?: string;
};

export class CheckoutConfigurationError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = "CheckoutConfigurationError";
  }
}

export async function prepareCheckoutOrder(order: CheckoutPayload) {
  const shippingMethodId =
    order.shippingMethodId || order.shipping?.id || "";
  const shippingMethod = getShippingMethodById(shippingMethodId);
  if (!shippingMethod)
    throw new CheckoutConfigurationError("SHIPPING_METHOD_UNAVAILABLE", 409);

  const customer = order.customer;
  const country = (customer.country || "France").trim().toLowerCase();
  if (country !== "fr" && country !== "france")
    throw new CheckoutConfigurationError("SHIPPING_COUNTRY_UNAVAILABLE", 400);
  if (!/^\s*\d+[A-Za-z]?(?:\s*(?:bis|ter|quater))?\s+\S+/i.test(customer.street))
    throw new CheckoutConfigurationError(
      "CUSTOMER_ADDRESS_REQUIRES_HOUSE_NUMBER",
      400,
    );
  if (!order.acceptTerms)
    throw new CheckoutConfigurationError("CGV_ACCEPTANCE_REQUIRED", 400);

  let items: ProductInfo[];
  try {
    items = await canonicalCommerceItems(
      (Array.isArray(order.items) && order.items.length > 0
        ? order.items
        : [order.product]) as ProductInfo[],
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "INVALID_CATALOG_ITEM" ||
        error.message === "INVALID_CATALOG_PRICE")
    )
      throw new CheckoutConfigurationError("INVALID_CATALOG_ITEM", 400);
    throw error;
  }
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const settings = await getMondialRelaySettings();
  const readiness = getMondialRelayProductionReadiness(settings);
  let relayPoint: RelayPoint | undefined;
  let shippingCents: number;
  if (shippingMethodId === MONDIAL_RELAY_POINT_RELAIS_ID) {
    if (!readiness.checkoutShippingReady)
      throw new CheckoutConfigurationError("SHIPPING_NOT_READY", 503);
    if (
      settings.fulfillmentMode === "manual_connect"
        ? !settings.manualConnectConfirmed
        : !readiness.shipmentCreationEnabled
    )
      throw new CheckoutConfigurationError("FULFILLMENT_NOT_READY", 503);
    const submittedPoint = order.relayPoint as RelayPoint | undefined;
    if (
      !submittedPoint ||
      submittedPoint.serviceCode !== settings.serviceCode ||
      !verifyMondialRelayPointProof(submittedPoint)
    )
      throw new CheckoutConfigurationError(
        "RELAY_POINT_INVALID_OR_EXPIRED",
        409,
      );
    const quote = getMondialRelayQuote(settings, itemCount);
    if (!quote)
      throw new CheckoutConfigurationError(
        "CONTRACT_SHIPPING_RATE_MISSING",
        409,
      );
    relayPoint = withoutMondialRelayPointProof(submittedPoint);
    shippingCents = quote.priceCents;
  } else if (shippingMethodId === MONDIAL_RELAY_HOME_ID) {
    if (
      !readiness.homeDeliveryReady ||
      process.env.REAL_SHIPPING_ENABLED !== "true" ||
      process.env.REAL_SHIPMENT_CREATION_ENABLED !== "true"
    )
      throw new CheckoutConfigurationError("HOME_DELIVERY_NOT_READY", 503);
    if (!/^(?:0[1-9]|[1-8][0-9]|9[0-5])[0-9]{3}$/.test(customer.zip))
      throw new CheckoutConfigurationError(
        "HOME_DELIVERY_DESTINATION_UNAVAILABLE",
        400,
      );
    const homePrice = getHomeDeliveryPriceCents(settings, itemCount);
    if (homePrice === null)
      throw new CheckoutConfigurationError(
        "CONTRACT_SHIPPING_RATE_MISSING",
        409,
      );
    shippingCents = homePrice;
  } else {
    throw new CheckoutConfigurationError("SHIPPING_METHOD_UNAVAILABLE", 409);
  }
  if (order.cgvVersion !== getCgvVersion(settings.preparationDays))
    throw new CheckoutConfigurationError("CGV_VERSION_MISMATCH", 409);

  const subtotalCents = items.reduce((sum, item) =>
    sum + Math.round(item.unitPrice * 100) * item.quantity, 0);
  return {
    items,
    itemCount,
    settings,
    shippingMethod,
    relayPoint,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    preparationDays: settings.preparationDays,
    cgvVersion: getCgvVersion(settings.preparationDays),
    promotionCode: order.promotionCode?.trim().toUpperCase() || undefined,
    fulfillmentMode: settings.fulfillmentMode,
  };
}
