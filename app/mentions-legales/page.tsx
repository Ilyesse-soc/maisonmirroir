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
      <p>
        Les informations complémentaires relatives à l’édition et à
        l’hébergement du site sont en cours de validation. Cette page ne
        constitue pas une version juridiquement finalisée.
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
