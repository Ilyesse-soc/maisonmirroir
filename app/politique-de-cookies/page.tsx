import LegalPage from "@/components/LegalPage";
import { AUDIENCE_IDENTITY_KEY, PRIVACY_PREFERENCES_KEY } from "@/lib/privacyConsent";

export const metadata = {
  title: "Politique de cookies - MAISON MIROIR",
  robots: { index: false, follow: true },
};

const storageInventory = [
  {
    name: "mm_cart",
    supplier: "MAISON MIROIR",
    purpose:
      "Identifiant technique du panier côté serveur. Les rappels par e-mail nécessitent un consentement distinct.",
    category: "Essentiel",
    duration: "30 jours",
    consent: "Non, strictement nécessaire au panier",
  },
  {
    name: "__Secure-better-auth.session_token",
    supplier: "MAISON MIROIR, authentification Better Auth",
    purpose: "Maintenir une session administrateur authentifiée et sécurisée.",
    category: "Essentiel",
    duration: "8 heures",
    consent: "Non, nécessaire à l’authentification",
  },
  {
    name: "mm:cart:v1 (localStorage)",
    supplier: "MAISON MIROIR",
    purpose: "Mémoriser les articles, variantes et quantités du panier.",
    category: "Essentiel",
    duration: "Jusqu’à l’effacement des données du navigateur; aucune expiration applicative",
    consent: "Non, nécessaire au panier",
  },
  {
    name: "mm:cart:shipping:v1 (localStorage)",
    supplier: "MAISON MIROIR",
    purpose: "Mémoriser le mode de livraison choisi dans le panier.",
    category: "Essentiel",
    duration: "Jusqu’à l’effacement des données du navigateur; aucune expiration applicative",
    consent: "Non, nécessaire au panier",
  },
  {
    name: `${PRIVACY_PREFERENCES_KEY} (localStorage)`,
    supplier: "MAISON MIROIR",
    purpose: "Mémoriser le choix des catégories facultatives.",
    category: "Essentiel",
    duration: "6 mois",
    consent: "Non, nécessaire au respect de votre choix",
  },
  {
    name: `${AUDIENCE_IDENTITY_KEY} (localStorage)`,
    supplier: "MAISON MIROIR",
    purpose:
      "Identifiants pseudonymes de visiteur et de session pour les statistiques, uniquement après accord.",
    category: "Mesure d’audience",
    duration:
      "Jusqu’au retrait ou à l’expiration du consentement; chaque jeton expire après 30 jours",
    consent: "Oui",
  },
  {
    name: "mm-audience-consent-v1 (localStorage, ancienne version)",
    supplier: "MAISON MIROIR",
    purpose:
      "Ancienne préférence lue uniquement pour arrêter et supprimer les données d’audience historiques.",
    category: "Essentiel",
    duration:
      "Ignoré pour toute nouvelle mesure; supprimé lors du prochain choix ou retrait",
    consent: "Non, utilisé uniquement pour respecter le choix précédent",
  },
  {
    name: "mm:orderSent:<PayPalOrderId> (sessionStorage)",
    supplier: "MAISON MIROIR",
    purpose: "Éviter une seconde soumission de la confirmation de paiement dans le même onglet.",
    category: "Essentiel",
    duration: "Session de l’onglet",
    consent: "Non, nécessaire à la confirmation de commande",
  },
  {
    name: "mm:lastOrder (sessionStorage)",
    supplier: "MAISON MIROIR",
    purpose: "Afficher le récapitulatif de commande sans coordonnées personnelles.",
    category: "Essentiel",
    duration: "Session de l’onglet",
    consent: "Non, nécessaire à l’affichage de la confirmation",
  },
];

export default function CookiesPolicy() {
  return (
    <LegalPage
      title="Politique de cookies"
      updatedAt="25 novembre 2026"
      provisional={false}
    >
      <p>
        <strong>MAISON MIROIR</strong>
      </p>
      <p>
        Chez MAISON MIROIR, nous accordons une importance particulière à la
        protection de votre vie privée et à la transparence concernant les
        technologies utilisées sur notre boutique en ligne.
      </p>

      <h2>1. Qu’est-ce qu’un cookie ?</h2>
      <p>
        Un cookie est un petit fichier enregistré sur votre appareil lorsque
        vous consultez un site internet.
      </p>
      <p>
        Les cookies et technologies similaires permettent notamment d’assurer
        le bon fonctionnement du site, de mémoriser certaines préférences et,
        lorsque cela est autorisé, de mesurer sa fréquentation.
      </p>

      <h2>2. Cookies strictement nécessaires</h2>
      <p>Ces cookies et stockages locaux sont indispensables au fonctionnement de notre boutique.</p>
      <p>Ils permettent notamment :</p>
      <ul>
        <li>De conserver les articles ajoutés à votre panier.</li>
        <li>De sécuriser votre navigation.</li>
        <li>De gérer les sessions nécessaires au fonctionnement du site.</li>
        <li>De faciliter le processus de commande.</li>
        <li>De mémoriser vos préférences concernant les cookies.</li>
      </ul>
      <p>
        Ces technologies ne nécessitent pas votre consentement lorsqu’elles sont
        strictement nécessaires au service demandé.
      </p>

      <h2>3. Mesure d’audience</h2>
      <p>
        MAISON MIROIR utilise un outil interne de mesure d’audience hébergé sur
        son infrastructure OVH afin de mieux comprendre la fréquentation de sa
        boutique et d’améliorer l’expérience proposée.
      </p>
      <p>Ces statistiques peuvent notamment indiquer :</p>
      <ul>
        <li>Le nombre de visites.</li>
        <li>Les pages consultées.</li>
        <li>La fréquentation des fiches produits.</li>
        <li>Le parcours de navigation.</li>
        <li>Les performances générales de la boutique.</li>
      </ul>
      <p>
        La mesure n’est pas présentée comme exemptée de consentement. Elle ne
        démarre qu’après votre accord. Elle n’utilise aucun fingerprinting et
        n’enregistre aucune adresse IP brute dans les données d’audience. Les
        identifiants sont pseudonymes. Les événements sont supprimés au plus
        tard après 30 jours et les sessions inactives sont supprimées après
        24 heures.
      </p>
      <p>
        La clé locale de l’ancienne préférence d’audience est ignorée pour
        toute nouvelle mesure et supprimée lors de la migration. Les données
        antérieures ne sont pas conservées au-delà de leur durée maximale de
        30 jours.
      </p>

      <h3>Inventaire des cookies et stockages utilisés</h3>
      <p>
        Le tableau distingue les cookies HTTP des stockages locaux du
        navigateur. Aucun outil publicitaire ou traceur marketing n’est
        actuellement utilisé. Les liens vers Instagram et TikTok sont des liens
        sortants, sans pixel ni contenu intégré.
      </p>
      <div
        className="cookie-inventory-scroll"
        role="region"
        aria-label="Inventaire des cookies et stockages"
        tabIndex={0}
      >
        <table className="cookie-inventory">
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">Fournisseur</th>
              <th scope="col">Finalité</th>
              <th scope="col">Catégorie</th>
              <th scope="col">Durée de conservation</th>
              <th scope="col">Consentement</th>
            </tr>
          </thead>
          <tbody>
            {storageInventory.map((item) => (
              <tr key={item.name}>
                <th scope="row">{item.name}</th>
                <td>{item.supplier}</td>
                <td>{item.purpose}</td>
                <td>{item.category}</td>
                <td>{item.duration}</td>
                <td>{item.consent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        L’authentification administrateur utilise un cookie sécurisé, HttpOnly
        et limité à 8 heures. Le cookie de panier est HttpOnly, sécurisé en
        production et limité à 30 jours. Les stockages localStorage et
        sessionStorage ne sont pas des cookies HTTP.
      </p>
      <p>
        Le SDK PayPal est sollicité uniquement dans le parcours de paiement
        lorsque celui-ci est activé. Les éventuels cookies déposés par PayPal
        sont contrôlés par ce prestataire et ne sont pas configurés par
        MAISON MIROIR. Aucun nom ni durée n’est attribué ici à des cookies
        tiers qui ne sont pas définis par notre application.
      </p>

      <h2>4. Services tiers</h2>
      <p>
        Dans le cadre du fonctionnement de notre boutique, certains services
        externes peuvent intervenir, notamment pour le paiement ou la livraison
        des commandes.
      </p>
      <p>
        Ces services peuvent utiliser leurs propres cookies ou technologies
        similaires selon les fonctionnalités sollicitées.
      </p>
      <p>
        Nous vous invitons à consulter leurs politiques de confidentialité
        pour connaître les modalités de traitement de vos données.
      </p>

      <h2>5. Gestion de votre consentement</h2>
      <p>
        Lors de votre première visite, vous pouvez accepter, refuser ou
        personnaliser l’utilisation des cookies facultatifs. Vous pouvez
        modifier ou retirer votre consentement à tout moment grâce au lien
        « Gérer mes cookies », accessible en bas de chaque page du site.
      </p>
      <p>
        Le refus des cookies facultatifs ne vous empêche pas de naviguer sur
        notre boutique ni de passer commande.
      </p>

      <h2>6. Durée de conservation</h2>
      <p>
        Vos préférences de consentement sont conservées pendant une durée de
        6 mois. Les durées de conservation des autres cookies et technologies
        similaires dépendent de leur finalité et sont indiquées dans le tableau
        ci-dessus.
      </p>

      <h2>7. Paramètres de votre navigateur</h2>
      <p>
        Vous pouvez également configurer votre navigateur afin de bloquer ou
        de supprimer certains cookies.
      </p>
      <p>
        Toutefois, la désactivation des cookies strictement nécessaires peut
        affecter certaines fonctionnalités de la boutique, notamment le panier
        et le processus de commande.
      </p>

      <h2>8. Protection des données personnelles</h2>
      <p>
        Pour obtenir davantage d’informations concernant le traitement de vos
        données personnelles et l’exercice de vos droits, vous pouvez consulter
        notre{" "}
        <a href="/politique-de-confidentialite">
          politique de confidentialité
        </a>
        .
      </p>

      <h2>9. Nous contacter</h2>
      <p>
        Pour toute question concernant notre politique de cookies ou la
        protection de vos données personnelles, vous pouvez nous contacter à
        l’adresse suivante :
      </p>
      <p>
        <strong>MAISON MIROIR</strong>
        <br />
        E-mail :{" "}
        <a href="mailto:maison.miroirs@gmail.com">
          maison.miroirs@gmail.com
        </a>
        <br />
        Site internet :{" "}
        <a href="https://maison-miroir.fr">https://maison-miroir.fr</a>
      </p>
      <p>Merci pour votre confiance.</p>
      <p>
        <strong>MAISON MIROIR - For Modest Girls</strong>
      </p>
    </LegalPage>
  );
}
