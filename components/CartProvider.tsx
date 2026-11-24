"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  type CartItem,
  getCartItemCount,
  mergeCartItems,
} from "@/lib/cart";
import {
  getShippingMethodById,
  MONDIAL_RELAY_POINT_RELAIS_ID,
} from "@/lib/shipping";
import {
  getMondialRelayQuote,
  type MondialRelaySettings,
  type RelayPoint,
} from "@/lib/mondialRelayTypes";
import {
  readCart,
  serverCart,
  subscribeCart,
  writeCart,
} from "@/lib/cartStorage";
type AddCartItemInput = Omit<CartItem, "key">;
type CartContextValue = {
  items: CartItem[];
  shippingMethodId: string;
  relayPoint: RelayPoint | null;
  itemCount: number;
  isReady: boolean;
  isDrawerOpen: boolean;
  flashMessage: string;
  selectedShippingPrice: number | null;
  selectedShippingPriceLabel: string;
  selectedShippingPriceIsSimulation: boolean;
  shippingConfigurationLoaded: boolean;
  checkoutEnabled: boolean;
  getShippingPriceQuote: (
    methodId: string,
    itemCount: number,
  ) => { price: number | null; label: string; isSimulation: boolean };
  addItem: (item: AddCartItemInput) => void;
  removeItem: (key: string) => void;
  updateItemQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  setShippingMethodId: (id: string) => void;
  setRelayPoint: (point: RelayPoint | null) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};
const CartContext = createContext<CartContextValue | null>(null);
const ready = () => true,
  notReady = () => false;
const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});
export function CartProvider({
  children,
  syncEnabled = true,
}: {
  children: React.ReactNode;
  syncEnabled?: boolean;
}) {
  const { items, shippingMethodId, relayPoint } = useSyncExternalStore(
    subscribeCart,
    readCart,
    serverCart,
  );
  const isReady = useSyncExternalStore(subscribeCart, ready, notReady);
  useEffect(() => {
    if (!isReady || !syncEnabled) return;
    const controller = new AbortController();
    void fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({
          id: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      }),
      signal: controller.signal,
    }).catch(() => {});
    return () => controller.abort();
  }, [items, isReady, syncEnabled]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false),
    [flashMessage, setFlashMessage] = useState("");
  const [shippingConfig, setShippingConfig] = useState<{
    settings: MondialRelaySettings;
    mode: "simulation" | "sandbox";
    shopOpen: boolean;
    paymentsEnabled: boolean;
    realShippingEnabled: false;
  } | null>(null);
  const [shippingConfigurationLoaded, setShippingConfigurationLoaded] =
    useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/shipping/config", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "SHIPPING_CONFIG_FAILED");
        if (active) setShippingConfig(data);
      })
      .catch(() => {
        if (active) setShippingConfig(null);
      })
      .finally(() => {
        if (active) setShippingConfigurationLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!flashMessage) return;
    const timer = setTimeout(() => setFlashMessage(""), 2200);
    return () => clearTimeout(timer);
  }, [flashMessage]);
  const getShippingPriceQuote = (methodId: string, quantity: number) => {
    const method = getShippingMethodById(methodId);
    if (!method) return { price: null, label: "À confirmer", isSimulation: false };
    if (method.carrier !== "Mondial Relay")
      return {
        price: method.price,
        label: euro.format(method.price),
        isSimulation: false,
      };
    if (
      methodId !== MONDIAL_RELAY_POINT_RELAIS_ID ||
      !shippingConfig
    )
      return { price: null, label: "À confirmer", isSimulation: false };
    const quote = getMondialRelayQuote(
      shippingConfig.settings,
      quantity,
      "simulation",
    );
    if (!quote)
      return { price: null, label: "À confirmer", isSimulation: false };
    const price = quote.priceCents / 100;
    return {
      price,
      label: `${euro.format(price)} - tarif provisoire de test`,
      isSimulation: true,
    };
  };
  const selectedMethod = getShippingMethodById(shippingMethodId);
  const isMondialRelayMethod = selectedMethod?.carrier === "Mondial Relay";
  const selectedQuote = getShippingPriceQuote(
    shippingMethodId,
    getCartItemCount(items),
  );
  const selectedShippingPrice = selectedQuote.price;
  const selectedShippingPriceIsSimulation = selectedQuote.isSimulation;
  const selectedShippingPriceLabel = selectedQuote.label;
  const value: CartContextValue = {
    items,
    shippingMethodId,
    relayPoint,
    itemCount: getCartItemCount(items),
    isReady,
    isDrawerOpen,
    flashMessage,
    selectedShippingPrice,
    selectedShippingPriceLabel,
    selectedShippingPriceIsSimulation,
    shippingConfigurationLoaded,
    getShippingPriceQuote,
    checkoutEnabled:
      shippingConfigurationLoaded &&
      Boolean(shippingConfig?.shopOpen) &&
      Boolean(shippingConfig?.paymentsEnabled) &&
      (!isMondialRelayMethod || Boolean(shippingConfig?.realShippingEnabled)),
    addItem(item) {
      const cart = readCart();
      writeCart({ ...cart, items: mergeCartItems(cart.items, item) });
      setFlashMessage("Produit ajout? au panier");
      setIsDrawerOpen(true);
    },
    removeItem(key) {
      const cart = readCart();
      writeCart({
        ...cart,
        items: cart.items.filter((item) => item.key !== key),
      });
    },
    updateItemQuantity(key, quantity) {
      if (!Number.isFinite(quantity)) return;
      const cart = readCart();
      writeCart({
        ...cart,
        items: cart.items.map((item) =>
          item.key === key
            ? { ...item, quantity: Math.max(1, Math.trunc(quantity)) }
            : item,
        ),
      });
    },
    clearCart() {
      writeCart({ ...readCart(), items: [], relayPoint: null });
    },
    setShippingMethodId(id) {
      if (getShippingMethodById(id)) {
        const cart = readCart();
        writeCart({
          ...cart,
          shippingMethodId: id,
          relayPoint:
            id === MONDIAL_RELAY_POINT_RELAIS_ID
              ? cart.relayPoint
              : null,
        });
      }
    },
    setRelayPoint(point) {
      if (point && shippingMethodId !== MONDIAL_RELAY_POINT_RELAIS_ID) return;
      writeCart({ ...readCart(), relayPoint: point });
    },
    openDrawer() {
      setIsDrawerOpen(true);
    },
    closeDrawer() {
      setIsDrawerOpen(false);
    },
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw Error("useCart must be used within CartProvider");
  return value;
}
