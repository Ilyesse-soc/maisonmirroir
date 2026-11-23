import Link from "next/link";
import ProductImageGallery from "@/components/ProductImageGallery";
import { launchCollectionProducts } from "@/lib/products";

export const metadata = {
  title: "La collection - MAISON MIROIR",
  description:
    "Découvrez Modest Era et Paradise Way, les deux tote bags de la première collection MAISON MIROIR.",
};

export default function CataloguePage() {
  return (
    <div className="storefront">
      <section className="editorial-page">
        <div className="storefront-wrap">
          <p className="storefront-eyebrow">Première collection - For Modest Girls</p>
          <h1>La collection</h1>
          <p className="editorial-intro">
            Deux tote bags imaginés pour accompagner ton quotidien et porter un
            message qui te ressemble.
          </p>
          <div className="storefront-products">
            {launchCollectionProducts.map((product) => (
              <article
                className="storefront-product-card"
                key={product.id}
              >
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
                      {product.availableForSale === true
                        ? "Disponible"
                        : "Bientôt disponible"}
                    </span>
                  </div>
                  <span className="storefront-product-price">
                    {product.price.toFixed(2).replace(".", ",")} €
                  </span>
                </Link>
              </article>
            ))}
          </div>
          <p className="storefront-note">
            Les commandes ne sont pas encore ouvertes. Les prix affichés sont
            indicatifs ; le stock et les modalités de vente seront confirmés
            avant l’ouverture.
          </p>
        </div>
      </section>
    </div>
  );
}
