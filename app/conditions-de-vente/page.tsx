import LegalPage from "@/components/LegalPage";

export const metadata = {
  title: "Conditions de vente - Maison Miroir",
  robots: { index: false, follow: true },
};

export default function SalesTermsPage() {
  return (
    <LegalPage title="Conditions de vente">
      <h2>Document en préparation</h2>
      <p>
        Les conditions de vente sont en cours de validation et ne sont pas
        publiées. Elles seront disponibles ici avant toute ouverture des
        commandes.
      </p>
      <p>Aucune commande ni aucun paiement n’est actuellement accepté.</p>
    </LegalPage>
  );
}
