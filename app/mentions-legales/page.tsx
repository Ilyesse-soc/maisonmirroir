import LegalPage from "@/components/LegalPage";
import { brandInfo } from "@/lib/brandInfo";
export const metadata = {
  title: "Mentions légales — Maison Miroir",
  robots: { index: false, follow: true },
};
export default function LegalNotice() {
  return (
    <LegalPage title="Mentions légales">
      <h2>Édition du site</h2>
      <dl>
        <dt>Nom commercial</dt>
        <dd>{brandInfo.name}</dd>
        <dt>Statut communiqué</dt>
        <dd>{brandInfo.status}</dd>
        <dt>Adresse professionnelle communiquée</dt>
        <dd>{brandInfo.address}</dd>
        <dt>SIRET communiqué, à confirmer</dt>
        <dd>{brandInfo.siret}</dd>
        <dt>Contact</dt>
        <dd>
          <a href={`mailto:${brandInfo.email}`}>{brandInfo.email}</a>
        </dd>
      </dl>
      <p className="legal-note">
        Les nom et prénom de l’entrepreneuse et l’identité de la responsable de
        publication restent à compléter. Le numéro SIRET transmis nécessite une
        vérification. Ces informations doivent être confirmées avant publication
        définitive de cette page.
      </p>
      <h2>Hébergement</h2>
      <p>
        La configuration du projet prévoit un VPS OVHcloud à Beauharnois, au
        Canada. L’entité juridique contractuelle de l’hébergeur, son adresse et
        son téléphone doivent être confirmés à partir du contrat d’hébergement.
        La configuration préparée ne prouve pas à elle seule le lieu
        d’hébergement effectif du site public.
      </p>
      <h2>Préouverture</h2>
      <p>
        Cette page présente Maison Miroir et sa liste privée. La boutique et les
        parcours d’achat restent fermés. Aucun achat n’est proposé depuis cette
        page.
      </p>
      <h2>Informations complémentaires</h2>
      <p>
        Le téléphone professionnel, les mentions d’immatriculation applicables
        et les informations relatives à la TVA, si elle est applicable, restent
        à confirmer.
      </p>
    </LegalPage>
  );
}
