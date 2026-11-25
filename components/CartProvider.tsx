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
  MONDIAL_RELAY_HOME_ID,
  MONDIAL_RELAY_POINT_RELAIS_ID,
} from "@/lib/shipping";
import {
  getHomeDeliveryPriceCents,
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
  shippingConfigurationLoaded: boolean;
  checkoutEnabled: boolean;
  paypalClientId: string;
  availableShippingMethodIds: string[];
  preparationDays: number;
  cgvVersion: string;
  catalogLoaded: boolean;
  getProductPrice: (id: string, fallback: number) => number;
  isProductAvailable: (id: string, fallback?: boolean) => boolean;
  getShippingPriceQuote: (
    methodId: string,
    itemCount: number,
  ) => { price: number | null; label: string };
  addItem: (item: AddCartItemInput) => Promise<boolean>;
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
  const [publicCatalog, setPublicCatalog] = useState<
    Record<string, { price: number; available: boolean }>
  >({});
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const fetchPublicCatalog = async () => {
    const response = await fetch("/api/commerce/catalog", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("CATALOG_UNAVAILABLE");
    const data = (await response.json()) as {
      products?: Array<{ id?: string; price?: number; available?: boolean }>;
    };
    const catalog: Record<string, { price: number; available: boolean }> = {};
    for (const product of data.products || []) {
      if (
        typeof product.id === "string" &&
        Number.isSafeInteger(Math.round(Number(product.price) * 100)) &&
        Number(product.price) > 0 &&
        typeof product.available === "boolean"
      )
        catalog[product.id] = {
          price: Number(product.price),
          available: product.available,
        };
    }
    setPublicCatalog(catalog);
    setCatalogLoaded(true);
    return catalog;
  };
  useEffect(() => {
    let active = true;
    fetch("/api/commerce/catalog", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("CATALOG_UNAVAILABLE");
        const data = (await response.json()) as {
          products?: Array<{
            id?: string;
            price?: number;
            available?: boolean;
          }>;
        };
        if (!active) return;
        const catalog: Record<string, { price: number; available: boolean }> =
          {};
        for (const product of data.products || []) {
          if (
            typeof product.id === "string" &&
            Number.isSafeInteger(Math.round(Number(product.price) * 100)) &&
            Number(product.price) > 0 &&
            typeof product.available === "boolean"
          )
            catalog[product.id] = {
              price: Number(product.price),
              available: product.available,
            };
        }
        setPublicCatalog(catalog);
      })
      .catch(() => {
        if (active) setPublicCatalog({});
      })
      .finally(() => {
        if (active) setCatalogLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!catalogLoaded) return;
    const nextItems = items.map((item) => {
      const current = publicCatalog[item.productId];
      return current ? { ...item, unitPrice: current.price } : item;
    });
    if (
      nextItems.some((item, index) => item.unitPrice !== items[index]?.unitPrice)
    )
      writeCart({
        ...readCart(),
        items: nextItems,
      });
  }, [catalogLoaded, publicCatalog, items]);
  const [shippingConfig, setShippingConfig] = useState<{
    settings: Pick<
      MondialRelaySettings,
      | "serviceCode"
      | "shippingTiers"
      | "homeDeliveryEnabled"
      | "homeDeliveryContractConfirmed"
      | "homeShippingTiers"
      | "preparationDays"
    >;
    availableShippingMethodIds: string[];
    cgvVersion: string;
    shopOpen: boolean;
    paymentsEnabled: boolean;
    realShippingEnabled: boolean;
    paypalClientId: string;
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
    if (!method) return { price: null, label: "À confirmer" };
    if (!shippingConfig) return { price: null, label: "À confirmer" };
    const priceCents =
      methodId === MONDIAL_RELAY_POINT_RELAIS_ID
        ? getMondialRelayQuote(shippingConfig.settings, quantity)?.priceCents
        : methodId === MONDIAL_RELAY_HOME_ID
          ? getHomeDeliveryPriceCents(shippingConfig.settings, quantity)
          : null;
    if (!priceCents)
      return { price: null, label: "À confirmer" };
    const price = priceCents / 100;
    return {
      price,
      label: euro.format(price),
    };
  };
  const selectedMethod = getShippingMethodById(shippingMethodId);
  const isMondialRelayMethod = selectedMethod?.carrier === "Mondial Relay";
  const selectedQuote = getShippingPriceQuote(
    shippingMethodId,
    getCartItemCount(items),
  );
  const selectedShippingPrice = selectedQuote.price;
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
    shippingConfigurationLoaded,
    getShippingPriceQuote,
    availableShippingMethodIds:
      shippingConfig?.availableShippingMethodIds || [],
    preparationDays: shippingConfig?.settings.preparationDays || 3,
    cgvVersion: shippingConfig?.cgvVersion || "",
    checkoutEnabled:
      shippingConfigurationLoaded &&
      Boolean(shippingConfig?.shopOpen) &&
      Boolean(shippingConfig?.paymentsEnabled) &&
      (!isMondialRelayMethod ||
        Boolean(shippingConfig?.realShippingEnabled)) &&
      Boolean(
        shippingConfig?.availableShippingMethodIds.includes(shippingMethodId),
      ),
    paypalClientId: shippingConfig?.paypalClientId || "",
    catalogLoaded,
    getProductPrice(id, fallback) {
      return publicCatalog[id]?.price ?? fallback;
    },
    isProductAvailable(id, fallback = false) {
      if (id === "modest-era" || id === "paradise-way")
        return publicCatalog[id]?.available === true;
      return publicCatalog[id]?.available ?? fallback;
    },
    async addItem(item) {
      let accepted = item;
      if (item.productId === "modest-era" || item.productId === "paradise-way") {
        try {
          const catalog = await fetchPublicCatalog();
          const entry = catalog[item.productId];
          if (!entry?.available) {
            setFlashMessage("Victime de son succès");
            return false;
          }
          accepted = { ...item, unitPrice: entry.price };
        } catch {
          setFlashMessage("Disponibilité momentanément indisponible");
          return false;
        }
      }
      const cart = readCart();
      writeCart({ ...cart, items: mergeCartItems(cart.items, accepted) });
      setFlashMessage("Produit ajout? au panier");
      setIsDrawerOpen(true);
      return true;
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
