import Link from "next/link";
import HomeVideoCarousel from "@/components/HomeVideoCarousel";
import ProductImageGallery from "@/components/ProductImageGallery";
import { launchCollectionProducts } from "@/lib/products";

export default function HomePage() {
  return (
    <div className="storefront">
      <HomeVideoCarousel />

      <section
        id="collection"
        className="home-collection"
        aria-labelledby="collection-title"
      >
        <div className="storefront-wrap">
          <header className="home-section-heading">
            <p className="storefront-eyebrow">Première collection</p>
            <h2 id="collection-title">For Modest Girls</h2>
          </header>

          <div className="home-product-grid">
            {launchCollectionProducts.map((product, index) => {
              const [featureType, productMessage = ""] =
                product.features[0].split(" - ");
              const productType = featureType.replace("chocolat", "marron");
              const message = productMessage.replace(/[«»]/g, "").trim();
              const collectionImage = product.images[0];

              return (
                <article
                  className="storefront-product-card home-product-card"
                  key={product.id}
                >
                  <ProductImageGallery
                    productName={product.name}
                    images={[collectionImage]}
                    mode="home"
                    interactive={false}
                    number={String(index + 1).padStart(2, "0")}
                  />
                  <div className="home-product-copy">
                    <div>
                      <p className="home-product-type">{productType}</p>
                      <h2>{product.name}</h2>
                      <p className="home-product-message">« {message} »</p>
                      <p className="home-product-description">
                        {product.description}
                      </p>
                    </div>
                    <Link
                      className="home-text-link"
                      href={`/product/${product.id}`}
                    >
                      Découvrir <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="home-collection-footer">
            <div className="home-order-notice" role="status">
              <p className="storefront-eyebrow">Ouverture des commandes</p>
              <p className="home-order-status">Pas encore ouverte</p>
              <p>
                Le stock et les modalités de vente seront confirmés avant
                l’ouverture.
              </p>
            </div>
            <Link className="home-outline-link" href="/catalogue">
              Voir la collection <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="home-story" aria-labelledby="home-story-title">
        <div className="storefront-wrap home-story-inner">
          <div>
            <p className="storefront-eyebrow">Modesty, identity, lifestyle</p>
            <h2 id="home-story-title">Notre histoire</h2>
          </div>
          <div className="home-story-copy">
            <p>
              MAISON MIROIR explore la modestie, l’identité et le lifestyle à
              travers des pièces qui portent un message personnel.
            </p>
            <p>
              Modest Era et Paradise Way ouvrent ce premier chapitre avec deux
              tote bags et deux messages distincts.
            </p>
            <Link className="home-text-link" href="/notre-histoire">
              Découvrir notre histoire <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
