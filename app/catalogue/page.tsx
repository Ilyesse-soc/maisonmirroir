import CollectionProductGrid from "@/components/CollectionProductGrid";
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
          <CollectionProductGrid products={launchCollectionProducts} />
          <p className="storefront-note">
            Les prix affichés reflètent les tarifs actuels. La disponibilité
            est mise à jour selon le stock de la collection.
          </p>
        </div>
      </section>
    </div>
  );
}
