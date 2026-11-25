import {
  CART_STORAGE_KEY,
  CART_SHIPPING_KEY,
  type CartSnapshot,
  type CartItem,
} from "./cart";
import { SHIPPING_METHODS, getShippingMethodById } from "./shipping";
import { isRelayPoint } from "./mondialRelayTypes";
const empty: CartSnapshot = {
  items: [],
  shippingMethodId: SHIPPING_METHODS[0]?.id || "",
  relayPoint: null,
};
let cached = empty,
  serialized: string | null = null;
export const serverCart = () => empty;
export function readCart(): CartSnapshot {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw === serialized) return cached;
    serialized = raw;
    const parsed = raw ? JSON.parse(raw) : {};
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .filter(
            (item: CartItem) =>
              item &&
              typeof item.key === "string" &&
              typeof item.productId === "string" &&
              typeof item.name === "string" &&
              Number.isFinite(item.unitPrice) &&
              item.unitPrice > 0 &&
              Number.isFinite(item.quantity) &&
              item.quantity > 0,
          )
          .map((item: CartItem) => ({
            ...item,
            quantity: Math.max(1, Math.trunc(item.quantity)),
          }))
      : [];
    const shipping = getShippingMethodById(
      parsed.shippingMethodId || localStorage.getItem(CART_SHIPPING_KEY) || "",
    );
    cached = {
      items,
      shippingMethodId: shipping?.id || empty.shippingMethodId,
      relayPoint: isRelayPoint(parsed.relayPoint) ? parsed.relayPoint : null,
      promotionCode: typeof parsed.promotionCode === "string" ? parsed.promotionCode.slice(0, 80) : "",
    };
  } catch {
    cached = empty;
  }
  return cached;
}
export function writeCart(snapshot: CartSnapshot) {
  cached = snapshot;
  serialized = JSON.stringify(snapshot);
  try {
    localStorage.setItem(CART_STORAGE_KEY, serialized);
    localStorage.setItem(CART_SHIPPING_KEY, snapshot.shippingMethodId);
  } catch {}
  window.dispatchEvent(new Event("mm:cart-change"));
}
export function subscribeCart(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("mm:cart-change", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("mm:cart-change", listener);
  };
}
