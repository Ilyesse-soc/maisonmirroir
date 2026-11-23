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
  getCartShippingPrice,
  mergeCartItems,
} from "@/lib/cart";
import { getShippingMethodById } from "@/lib/shipping";
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
  itemCount: number;
  isReady: boolean;
  isDrawerOpen: boolean;
  flashMessage: string;
  selectedShippingPrice: number;
  addItem: (item: AddCartItemInput) => void;
  removeItem: (key: string) => void;
  updateItemQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  setShippingMethodId: (id: string) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};
const CartContext = createContext<CartContextValue | null>(null);
const ready = () => true,
  notReady = () => false;
export function CartProvider({
  children,
  syncEnabled = true,
}: {
  children: React.ReactNode;
  syncEnabled?: boolean;
}) {
  const { items, shippingMethodId } = useSyncExternalStore(
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
  useEffect(() => {
    if (!flashMessage) return;
    const timer = setTimeout(() => setFlashMessage(""), 2200);
    return () => clearTimeout(timer);
  }, [flashMessage]);
  const value: CartContextValue = {
    items,
    shippingMethodId,
    itemCount: getCartItemCount(items),
    isReady,
    isDrawerOpen,
    flashMessage,
    selectedShippingPrice: getCartShippingPrice(shippingMethodId),
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
      writeCart({ ...readCart(), items: [] });
    },
    setShippingMethodId(id) {
      if (getShippingMethodById(id))
        writeCart({ ...readCart(), shippingMethodId: id });
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
