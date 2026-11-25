import type { ShippingMethod } from "@/lib/shipping";
import type { RelayPoint } from "@/lib/mondialRelayTypes";

export type PaymentMethod = "PAYPAL" | "CARD";

export type OrderStatus =
  | "En attente"
  | "Payee"
  | "En preparation"
  | "Prete a expedier"
  | "Expediee"
  | "Livree"
  | "Annulee";

export type OrderReturnStatus =
  | "none"
  | "requested"
  | "accepted"
  | "awaiting_receipt"
  | "received"
  | "refund_in_progress"
  | "refunded";

export type CustomerInfo = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
  country?: string;
};

export type ProductInfo = {
  id: string;
  name: string;
  category: string;
  categoryLabel?: string;
  unitPrice: number;
  quantity: number;
  message?: string;
};

export type ShippingSelection = Pick<
  ShippingMethod,
  | "id"
  | "label"
  | "shortLabel"
  | "carrier"
  | "estimatedDelay"
  | "trackingBaseUrl"
> & {
  price: number;
  relayPoint?: RelayPoint;
  mondialRelayShipment?: MondialRelayShipment;
};

export type MondialRelayTrackingEvent = {
  label: string;
  date: string;
  time: string;
  location: string;
  relayNumber?: string;
  country?: string;
};

export type MondialRelayShipmentStatus =
  | "creating"
  | "created"
  | "unknown"
  | "tracking";

export type MondialRelayShipment = {
  status: MondialRelayShipmentStatus;
  attemptId: string;
  trackingAttemptId?: string;
  reservedAt: string;
  shipmentNumber?: string;
  labelUrl?: string;
  labelAvailable?: boolean;
  providerErrorCode?: string;
  trackingEvents?: MondialRelayTrackingEvent[];
  trackingSummary?: string;
  trackingRelayNumber?: string;
  trackingRelayLabel?: string;
  trackingCheckedAt?: string;
  trackingErrorCode?: string;
};

export type OrderPayload = {
  product: ProductInfo;
  items?: ProductInfo[];
  customValues?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    contentType: string;
    base64: string;
  }>;
  customer: CustomerInfo;
  shippingMethodId: string;
  relayPoint?: RelayPoint;
  acceptTerms: boolean;
  cgvVersion: string;
};

export type OrderRecord = {
  orderId: string;
  orderDate: string;
  paymentMethod: PaymentMethod;
  paypalOrderId?: string;
  customer: CustomerInfo;
  items: ProductInfo[];
  customValues: Record<string, string>;
  shipping: ShippingSelection;
  subtotal: number;
  total: number;
  status: OrderStatus;
  trackingNumber?: string;
  trackingUrl?: string;
  paidAt?: string;
  preparationDeadline?: string;
  legalAcceptance?: {
    version: string;
    acceptedAt: string;
  };
};
