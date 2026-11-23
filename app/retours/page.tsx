import LegalPage from "@/components/LegalPage";

export const metadata = {
  title: "Retours et remboursements - Maison Miroir",
  robots: { index: false, follow: true },
};

export default function ReturnsPage() {
  return (
    <LegalPage title="Retours, remboursements et annulations">
      <h2>Modalités en cours de validation</h2>
      <p>
        Les modalités de rétractation, de retour, de remboursement et
        d’annulation sont en cours de vérification au regard des règles
        applicables. Elles seront publiées ici avant toute ouverture des
        commandes.
      </p>
      <p>Aucune commande ne peut actuellement être validée.</p>
    </LegalPage>
  );
}
