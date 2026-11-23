import LegalPage from "@/components/LegalPage";

export const metadata = {
  title: "Politique de cookies - Maison Miroir",
  robots: { index: false, follow: true },
};

export default function CookiesPolicy() {
  return (
    <LegalPage title="Politique de cookies">
      <h2>Document en cours de validation</h2>
      <p>
        Les informations détaillées sur les cookies et les stockages locaux
        utilisés par le site sont en cours de vérification. Cette page sera
        complétée avant l’ouverture des commandes.
      </p>
      <p>
        Les commandes et les paiements sont fermés. Les scripts de paiement ne
        sont pas chargés pour les produits de la première collection.
      </p>
    </LegalPage>
  );
}
