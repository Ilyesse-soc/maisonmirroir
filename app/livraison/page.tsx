import LegalPage from "@/components/LegalPage";

export const metadata = {
  title: "Livraison - MAISON MIROIR",
  robots: { index: false, follow: true },
};

export default function ShippingPage() {
  return (
    <LegalPage title="Livraison">
      <h2>Modalités en cours de confirmation</h2>
      <p>
        Les destinations desservies, transporteurs, tarifs, éventuel seuil de
        livraison gratuite et délais de préparation et d’acheminement restent
        à confirmer. Les modalités validées seront publiées ici avant
        l’ouverture des commandes.
      </p>
      <p>Aucune commande ne peut actuellement être validée.</p>
    </LegalPage>
  );
}
