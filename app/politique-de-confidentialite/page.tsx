import LegalPage from "@/components/LegalPage";
import { brandInfo } from "@/lib/brandInfo";
export const metadata = {
  title: "Politique de confidentialité — Maison Miroir",
  robots: { index: false, follow: true },
};
export default function PrivacyPolicy() {
  return (
    <LegalPage title="Politique de confidentialité">
      <h2>Votre interlocutrice</h2>
      <p>
        Le site est présenté sous le nom commercial {brandInfo.name},
        micro-entreprise, à l’adresse {brandInfo.address}. Pour toute question
        sur vos données :{" "}
        <a href={`mailto:${brandInfo.email}`}>{brandInfo.email}</a>.
      </p>
      <p className="legal-note">
        L’identité civile de la responsable du traitement, les durées
        définitives de conservation et les garanties contractuelles des
        prestataires restent à confirmer avant publication définitive.
      </p>
      <h2>Inscription à la liste privée</h2>
      <p>
        Le formulaire recueille votre adresse e-mail et votre accord pour
        recevoir les annonces de lancement, nouveautés et offres Maison Miroir.
        La case de consentement est initialement décochée. Un lien de
        confirmation par e-mail active l’abonnement ; sa validité est de 48
        heures. La base juridique de ces communications est votre consentement.
      </p>
      <p>
        Le système conserve l’adresse, le statut d’abonnement, les dates et la
        version du consentement, la confirmation et une empreinte de l’adresse
        IP. Les demandes d’envoi, erreurs, rebonds et désinscriptions sont
        enregistrés pour gérer les communications. L’empreinte IP et les quotas
        servent à limiter le spam et les abus, au titre de l’intérêt légitime à
        sécuriser le service.
      </p>
      <h2>Désinscription</h2>
      <p>
        Chaque communication commerciale comprend un lien de désinscription. Le
        retrait de votre consentement arrête les futurs envois commerciaux, sans
        remettre en cause les traitements antérieurs. Vous pouvez aussi
        contacter la marque par e-mail.
      </p>
      <h2>Conservation</h2>
      <p>
        Les abonnements actifs sont conservés tant que l’inscription est
        maintenue. Le script de nettoyage du projet prévoit de retirer les
        demandes non confirmées après 30 jours et les fiches désinscrites ou
        supprimées des envois après une durée configurable, de 730 jours par
        défaut. Son exécution et la valeur effectivement déployée ne sont pas
        vérifiées ; il ne s’agit pas d’une garantie de purge automatique.
      </p>
      <p>
        Une durée de réexamen des abonnements inactifs et des règles de
        conservation des preuves, historiques et sauvegardes doivent encore être
        fixées et appliquées par la responsable.
      </p>
      <h2>Prestataires et localisation</h2>
      <p>
        Le code utilise PostgreSQL pour stocker les abonnements et Resend pour
        envoyer les messages et recevoir les événements de livraison. La
        configuration préparée vise un VPS OVHcloud au Canada. Les accès sont
        réservés aux personnes habilitées et aux prestataires nécessaires à ces
        opérations.
      </p>
      <p>
        La localisation effectivement utilisée, les sous-traitants, les lieux de
        sauvegarde et les garanties applicables aux transferts hors Espace
        économique européen doivent être confirmés dans les contrats. Une
        conformité automatique liée au seul pays d’hébergement n’est pas
        présumée.
      </p>
      <h2>Navigation et espace privé</h2>
      <p>
        La page de préouverture ne charge pas d’outil publicitaire ou de mesure
        d’audience dans son code. Les liens Instagram et TikTok ouvrent les
        plateformes uniquement lorsque vous les suivez. L’espace
        d’administration utilise une session sécurisée et un historique
        d’actions. Les fonctions de panier, paiement et relance de l’ancienne
        boutique sont conservées dans le projet, mais les parcours d’achat
        restent fermés.
      </p>
      <h2>Vos droits</h2>
      <p>
        Vous pouvez demander l’accès, la rectification, l’effacement, la
        limitation et, selon les conditions applicables, la portabilité de vos
        données ou vous opposer à un traitement fondé sur l’intérêt légitime.
        Adressez votre demande à{" "}
        <a href={`mailto:${brandInfo.email}`}>{brandInfo.email}</a>. Vous pouvez
        également introduire une réclamation auprès de la{" "}
        <a href="https://www.cnil.fr/fr/plaintes">CNIL</a>.
      </p>
    </LegalPage>
  );
}
