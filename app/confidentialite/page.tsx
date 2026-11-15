import Link from "next/link";
import "../newsletter/newsletter.css";
export default function PrivacyPage() {
  return (
    <main className="newsletter-page">
      <Link href="/">← Maison Miroir</Link>
      <h1>Vos données, avec soin.</h1>
      <p>
        Votre adresse e-mail sert à vous envoyer, avec votre consentement, les
        annonces de lancement, nouveautés, collections et offres Maison Miroir.
        L’inscription est activée après votre confirmation par e-mail. Vous
        pouvez retirer votre consentement avec le lien présent dans chaque
        communication commerciale.
      </p>
      <p>
        Nous conservons l’adresse, le statut d’abonnement, les dates de
        consentement et de confirmation, la version de l’information acceptée et
        une empreinte technique de l’adresse IP. Cette empreinte sert à limiter
        les abus. Les historiques techniques permettent de suivre les demandes
        d’envoi, les erreurs et les désinscriptions. Aucune statistique
        d’ouverture ou de clic n’est affichée par ce site.
      </p>
      <p>
        Les envois sont traités par Resend. La durée de conservation est
        configurable ; la valeur technique proposée est de 24 mois après
        désinscription, et de 30 jours pour les inscriptions non confirmées. La
        politique définitive et les éventuels transferts internationaux doivent
        être validés par la responsable de la marque avant ouverture du service.
      </p>
      <p>
        Pour demander l’accès, la rectification ou la suppression de vos données
        : <a href="mailto:maison.miroirs@gmail.com">maison.miroirs@gmail.com</a>
        . Vous pouvez également saisir la CNIL.
      </p>
      <p>
        Informations en cours de finalisation : identité et adresse de la
        responsable du traitement, hébergement définitif, durées et garanties
        contractuelles applicables.
      </p>
    </main>
  );
}
