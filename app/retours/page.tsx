import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { CGV_UPDATED_AT } from "@/lib/legalVersion";

export const metadata = {
  title: "Retours et remboursements - MAISON MIROIR",
  robots: { index: false, follow: true },
};

export default function ReturnsPage() {
  return (
    <LegalPage
      title="Retours, remboursements et annulations"
      updatedAt={CGV_UPDATED_AT}
    >
      <h2>Exercer votre droit de rétractation</h2>
      <p>
        Vous disposez du délai légal de 14 jours à compter de la réception de
        votre commande pour exercer votre droit de rétractation. Vous pouvez
        utiliser le{" "}
        <Link href="/retractation">formulaire de rétractation en ligne</Link> ou
        nous écrire à{" "}
        <a href="mailto:maison.miroirs@gmail.com">maison.miroirs@gmail.com</a>.
        Indiquez le numéro de commande concerné. Un accusé de réception est
        envoyé par e-mail après réception de la demande.
      </p>
      <p>
        Après avoir informé MAISON MIROIR de votre décision, vous disposez de
        14 jours supplémentaires pour retourner les produits concernés. Les
        frais directs de retour sont à la charge de la cliente, sauf accord
        contraire de MAISON MIROIR ou disposition légale différente.
      </p>

      <h2>État des produits retournés</h2>
      <p>
        Les produits doivent être retournés dans un état permettant de vérifier
        leur nature, leurs caractéristiques et leur bon fonctionnement. Vous
        pouvez les manipuler dans la mesure nécessaire pour les examiner. Une
        dépréciation résultant de manipulations allant au-delà de ce qui est
        nécessaire peut entraîner une retenue proportionnée dans les conditions
        prévues par la loi.
      </p>

      <h2>Remboursement</h2>
      <p>
        Après réception et vérification du colis retourné, MAISON MIROIR traite
        la demande de remboursement. Le remboursement est effectué avec le même
        moyen de paiement que celui utilisé lors de la commande, sauf accord
        exprès pour un autre moyen. Pour une rétractation portant sur la totalité
        de la commande, les frais de livraison standard initiaux sont également
        remboursés.
      </p>
      <p>
        Les remboursements PayPal sont déclenchés manuellement par MAISON
        MIROIR. Une demande de rétractation ou un retour ne déclenche pas
        automatiquement un remboursement. Le remboursement peut être différé
        jusqu’à récupération du produit ou réception d’une preuve de son
        expédition, dans les conditions légales.
      </p>

      <h2>Demande de retour et suivi administratif</h2>
      <p>
        Après l’envoi de votre demande en ligne, celle-ci est transmise à
        MAISON MIROIR pour traitement. L’acceptation du retour, la réception du
        colis et le remboursement sont des étapes distinctes. Contactez-nous à
        l’adresse e-mail ci-dessus pour organiser la procédure de retour.
      </p>
      <p>
        Consultez les{" "}
        <Link href="/conditions-de-vente">Conditions générales de vente</Link>{" "}
        et la <Link href="/livraison">politique de livraison</Link>. Cette page
        est provisoire et reste soumise à validation juridique.
      </p>
    </LegalPage>
  );
}
