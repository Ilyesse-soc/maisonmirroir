import LegalPage from "@/components/LegalPage";
export const metadata = {
  title: "Politique de confidentialité - MAISON MIROIR",
  robots: { index: false, follow: true },
};

export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updatedAt="25 novembre 2026"
    >
      <h2>Document en cours de validation</h2>
      <p>
        La politique de confidentialité complète est en cours de vérification.
        Elle sera publiée avant toute ouverture des commandes ou reprise des
        inscriptions publiques.
      </p>
      <p>
        Les inscriptions publiques à la liste privée sont fermées. Pour toute
        question relative aux données déjà communiquées ou aux données d’une
        commande, contactez MAISON MIROIR à{" "}
        <a href="mailto:maison.miroirs@gmail.com">maison.miroirs@gmail.com</a>.
        Un achat ne crée pas d’inscription à la newsletter. Consultez les{" "}
        <a href="/conditions-de-vente">Conditions générales de vente</a>. Pour
        les données déjà communiquées, vous pouvez également utiliser le lien
        de désinscription de vos e-mails.
      </p>
      <p>
        Les informations détaillées sur les finalités, durées de conservation
        et destinataires des données restent à valider avant l’ouverture des
        commandes.
      </p>
    </LegalPage>
  );
}
