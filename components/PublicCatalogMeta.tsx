"use client";

import { useCart } from "@/components/CartProvider";

export default function PublicCatalogMeta({
  productId,
  fallbackPrice,
  fallbackAvailable,
  className,
}: {
  productId: string;
  fallbackPrice: number;
  fallbackAvailable?: boolean;
  className?: string;
}) {
  const { getProductPrice, isProductAvailable } = useCart();
  const price = getProductPrice(productId, fallbackPrice);
  const available = isProductAvailable(productId, fallbackAvailable);
  return (
    <div
      className={className}
      style={{ display: "grid", justifyItems: "center", gap: 7 }}
    >
      <span
        style={{
          fontFamily: "var(--font-display, inherit)",
          fontSize: 18,
          color: "#b08d57",
        }}
      >
        {price.toFixed(2).replace(".", ",")} €
      </span>
      <span className="storefront-status">
        {available ? "Disponible" : "Victime de son succès"}
      </span>
    </div>
  );
}
