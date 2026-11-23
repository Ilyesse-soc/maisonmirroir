import LegalPage from "@/components/LegalPage";
export const metadata = {
  title: "Politique de confidentialité - Maison Miroir",
  robots: { index: false, follow: true },
};

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Politique de confidentialité">
      <h2>Document en cours de validation</h2>
      <p>
        La politique de confidentialité complète est en cours de vérification.
        Elle sera publiée avant toute ouverture des commandes ou reprise des
        inscriptions publiques.
      </p>
      <p>
        Les inscriptions publiques à la liste privée sont fermées. Pour toute
        question relative aux données déjà communiquées, contactez Maison
        Miroir à l’adresse de contact indiquée sur la page{" "}
        <a href="/contact">Contact</a>. Les personnes abonnées peuvent
        également utiliser le lien de désinscription de leurs e-mails.
      </p>
    </LegalPage>
  );
}
