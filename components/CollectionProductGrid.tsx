"use client";

import Link from "next/link";
import ProductImageGallery from "@/components/ProductImageGallery";
import { useCart } from "@/components/CartProvider";
import type { Product } from "@/lib/products";

export default function CollectionProductGrid({
  products,
}: {
  products: Product[];
}) {
  const { getProductPrice, isProductAvailable } = useCart();
  return (
    <div className="storefront-products">
      {products.map((product) => (
        <article className="storefront-product-card" key={product.id}>
          <ProductImageGallery
            productName={product.name}
            images={product.images}
            mode="card"
          />
          <Link
            className="storefront-product-copy"
            href={`/product/${product.id}`}
          >
            <div>
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <span className="storefront-status">
                {isProductAvailable(
                  product.id,
                  product.availableForSale === true,
                )
                  ? "Disponible"
                  : "Victime de son succès"}
              </span>
            </div>
            <span className="storefront-product-price">
              {getProductPrice(product.id, product.price)
                .toFixed(2)
                .replace(".", ",")}{" "}
              €
            </span>
          </Link>
        </article>
      ))}
    </div>
  );
}
