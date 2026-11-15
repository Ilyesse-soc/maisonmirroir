import LegalPage from "@/components/LegalPage";
export const metadata = {
  title: "Politique de cookies — Maison Miroir",
  robots: { index: false, follow: true },
};
export default function CookiesPolicy() {
  return (
    <LegalPage title="Politique de cookies">
      <h2>La page de préouverture</h2>
      <p>
        Cette version ne contient aucun script publicitaire, outil de mesure
        d’audience, vidéo intégrée ou publication sociale embarquée sur la page
        de lancement. Les polices et l’image sont servies par le site. Le
        formulaire de newsletter ne repose pas sur un cookie publicitaire.
      </p>
      <p>
        Instagram et TikTok sont des liens ordinaires : ces services ne sont pas
        chargés dans la page. Leurs propres règles s’appliquent lorsque vous les
        visitez.
      </p>
      <h2>Fonctions techniques du projet</h2>
      <ul>
        <li>
          <strong>Administration :</strong> les cookies de session Better Auth
          maintiennent une connexion autorisée et sécurisent l’espace privé. La
          session est limitée à huit heures et est supprimée lors de la
          déconnexion.
        </li>
        <li>
          <strong>Ancienne boutique, fermée :</strong> le cookie{" "}
          <code>mm_cart</code> est prévu pour retrouver un panier pendant 30
          jours. Le stockage local <code>mm:cart:v1</code> et{" "}
          <code>mm:cart:shipping:v1</code> mémorise panier et livraison sans
          expiration automatique. Le stockage de session évite de répéter
          certaines confirmations de commande. Ces fonctions ne sont pas montées
          sur la page publique de préouverture.
        </li>
        <li>
          <strong>Paiement :</strong> le composant PayPal appartient au tunnel
          d’achat conservé. Il n’est pas chargé par la page de préouverture. Ses
          traceurs devront être réévalués avant réouverture.
        </li>
      </ul>
      <h2>Vos choix</h2>
      <p>
        Aucune bannière publicitaire n’est ajoutée pour ces seuls usages
        techniques. Le consentement à la newsletter est demandé séparément. Tout
        futur outil non essentiel nécessitera une réévaluation de cette
        politique et du mécanisme de consentement avant activation.
      </p>
      <p>
        Vous pouvez effacer les cookies et le stockage local dans les réglages
        de votre navigateur. Effacer une session d’administration entraîne une
        déconnexion ; effacer les données du panier supprime sa mémorisation sur
        cet appareil.
      </p>
    </LegalPage>
  );
}
