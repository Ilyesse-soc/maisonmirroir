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
      <h2>Mesure d’audience facultative</h2>
      <p>
        Si vous l’autorisez, des identifiants aléatoires de visiteur et de
        session servent à produire des statistiques de fréquentation et de
        navigation. Les pages consultées et l’étape du parcours sont
        enregistrées sans adresse IP, nom, coordonnées ou contenu de panier.
        Les événements sont supprimés au plus tard après 30 jours. Vous pouvez
        retirer votre accord depuis « Préférences statistiques ».
      </p>
    </LegalPage>
  );
}
