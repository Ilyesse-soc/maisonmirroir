import LegalPage from "@/components/LegalPage";

export const metadata = {
  title: "Politique de cookies - MAISON MIROIR",
  robots: { index: false, follow: true },
};

export default function CookiesPolicy() {
  return (
    <LegalPage title="Politique de cookies">
      <p>
        MAISON MIROIR utilise le stockage local du navigateur pour mémoriser
        votre choix concernant la mesure d’audience et, selon les fonctions
        utilisées, les éléments de votre panier.
      </p>
      <h2>Mesure d’audience facultative</h2>
      <p>
        La mesure de fréquentation ne démarre qu’après votre autorisation
        explicite. Elle enregistre un identifiant aléatoire de visiteur et de
        session, les pages consultées, ainsi que l’étape du parcours (navigation,
        panier ou paiement). Ces données ne contiennent ni adresse IP, ni nom,
        ni adresse e-mail, ni adresse postale. Les événements sont conservés au
        maximum 30 jours. Les sessions actives sont estimées à partir d’un
        signal envoyé toutes les 30 secondes et expirent après 90 secondes sans
        signal.
      </p>
      <p>
        Vous pouvez refuser ou retirer votre autorisation à tout moment avec le
        bouton « Préférences statistiques » affiché sur le site. Le retrait
        arrête la mesure et demande la suppression des données associées à cet
        identifiant. Le refus n’empêche pas l’utilisation de la boutique.
      </p>
      <h2>Panier et fonctionnement du site</h2>
      <p>
        Le stockage du panier est utilisé pour conserver les articles choisis
        pendant votre navigation. Il est distinct de la mesure d’audience et ne
        dépend pas de votre choix relatif aux statistiques. Aucun outil
        statistique n’est chargé avant votre autorisation.
      </p>
    </LegalPage>
  );
}
