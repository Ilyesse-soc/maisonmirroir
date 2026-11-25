import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { CGV_UPDATED_AT } from "@/lib/legalVersion";

export const metadata = {
  title: "Mentions légales - MAISON MIROIR",
  robots: { index: false, follow: true },
};

export default function LegalNotice() {
  return (
    <LegalPage title="Mentions légales" updatedAt={CGV_UPDATED_AT}>
      <h2>Éditeur du site</h2>
      <p>Le site https://maison-miroir.fr est édité par MAISON MIROIR.</p>
      <ul>
        <li>Nom commercial : MAISON MIROIR</li>
        <li>Statut juridique : Entreprise individuelle, micro-entreprise</li>
        <li>SIREN : 102 982 576</li>
        <li>SIRET : 102 982 576 00013</li>
        <li>
          Adresse professionnelle : 65 rue d’Aigremont, Appartement 51, 78300
          Poissy, France
        </li>
        <li>
          Contact :{" "}
          <a href="mailto:maison.miroirs@gmail.com">maison.miroirs@gmail.com</a>
        </li>
      </ul>
      <h2>Hébergeur</h2>
      <p>OVH SAS, société par actions simplifiée au capital de 50 000 000 €.</p>
      <ul>
        <li>RCS Lille Métropole : 424 761 419 00045</li>
        <li>Code APE : 2620Z</li>
        <li>Numéro de TVA : FR 22 424 761 419</li>
        <li>Siège social : 2 rue Kellermann, 59100 Roubaix, France</li>
      </ul>
      <p>
        Consultez les{" "}
        <a href="https://www.ovhcloud.com/fr/terms-and-conditions/">
          mentions légales officielles d’OVHcloud
        </a>
        .
      </p>
      <p>
        Cette page ne constitue pas une version juridiquement finalisée.
      </p>
      <p>
        Consultez également les{" "}
        <Link href="/conditions-de-vente">Conditions générales de vente</Link>, la{" "}
        <Link href="/livraison">politique de livraison</Link> et les{" "}
        <Link href="/retours">conditions de retour et de remboursement</Link>.
      </p>
    </LegalPage>
  );
}
