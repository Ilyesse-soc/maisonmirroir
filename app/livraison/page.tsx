import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { getPublicPreparationDays } from "@/lib/publicPreparationDays";
import { CGV_UPDATED_AT } from "@/lib/legalVersion";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Politique de livraison - MAISON MIROIR",
  robots: { index: false, follow: true },
};

export default async function ShippingPage() {
  const preparationDays = await getPublicPreparationDays();

  return (
    <LegalPage title="Politique de livraison" updatedAt={CGV_UPDATED_AT}>
      <p>
        Chez MAISON MIROIR, nous mettons tout en œuvre pour préparer et expédier
        vos commandes avec soin afin que vos petits colis arrivent jusqu’à vous
        dans les meilleures conditions. 🤎
      </p>

      <h2>1. Modes de livraison</h2>
      <p>
        Les options disponibles sont présentées au checkout selon le service
        Mondial Relay autorisé et activé pour votre commande.
      </p>
      <h3>Livraison en Point Relais - Mondial Relay</h3>
      <p>
        Votre commande est expédiée vers le Point Relais sélectionné lors de
        votre achat. Vous recevez une notification lorsque le colis est
        disponible au retrait, si cette information est fournie par le
        transporteur.
      </p>
      <h3>Livraison à domicile - Mondial Relay</h3>
      <p>
        La livraison à domicile est prévue en France métropolitaine au tarif de
        7,49 € TTC pour un sac de 500 g, dans un colis de 30 x 21 x 6 cm. Ce mode
        sera proposé au checkout uniquement après confirmation de l’autorisation
        API2 HOM par le contrat de production Mondial Relay.
      </p>

      <h2>2. Frais de livraison</h2>
      <p>Les frais de livraison sont à la charge de la cliente.</p>
      <ul>
        <li>Point Relais, un sac : 4,10 € TTC.</li>
        <li>Point Relais, deux sacs : 4,54 € TTC.</li>
        <li>Domicile, un sac : 7,49 € TTC en France métropolitaine.</li>
      </ul>
      <p>
        Pour deux sacs ou plus en livraison à domicile, les paliers sont
        configurables par MAISON MIROIR. Pour toute quantité dont le tarif ou
        les dimensions ne sont pas confirmés, aucun tarif supplémentaire n’est
        inventé et la commande n’est pas validable. Le montant applicable est
        calculé et affiché avant le paiement. Une promotion éventuelle ne
        s’applique pas aux frais de livraison.
      </p>

      <h2>3. Préparation des commandes</h2>
      <p>
        Chaque commande est préparée avec attention par MAISON MIROIR.{" "}
        {preparationDays === null
          ? "Le délai de préparation est temporairement indisponible. Aucune commande ne peut être validée pendant cette indisponibilité."
          : `Le délai de préparation par défaut est de ${preparationDays} jours ouvrés à compter de la confirmation du paiement.`}{" "}
        Les commandes sont préparées et déposées auprès de Mondial Relay les
        jours ouvrés, hors week-ends et jours fériés.
      </p>
      <p>
        En période de forte activité, notamment lors des lancements de
        collection, un délai supplémentaire peut exceptionnellement être
        nécessaire. Toute modification importante du délai annoncé sera
        communiquée aux clientes concernées.
      </p>

      <h2>4. Délais de livraison</h2>
      <p>
        Les délais de livraison dépendent du transporteur et du mode de
        livraison choisi. Ils sont communiqués à titre indicatif et peuvent
        varier en fonction des périodes d’activité, des conditions de transport
        et d’éventuels incidents indépendants de notre volonté. Le délai de
        préparation s’ajoute au délai d’acheminement du transporteur. MAISON
        MIROIR s’engage à respecter le délai de livraison annoncé lors de la
        commande.
      </p>

      <h2>5. Suivi de commande</h2>
      <p>
        Une fois votre commande expédiée, un numéro de suivi vous est communiqué
        par e-mail lorsque le transporteur le met à disposition. Vous pouvez
        suivre l’acheminement directement sur le site du transporteur concerné.
        Nous vous invitons à vérifier régulièrement le suivi jusqu’à la
        réception de votre commande.
      </p>

      <h2>6. Adresse de livraison</h2>
      <p>La cliente est responsable des informations renseignées lors de sa commande.</p>
      <p>Il est important de vérifier soigneusement :</p>
      <ul>
        <li>Votre nom et prénom.</li>
        <li>Votre adresse complète.</li>
        <li>Votre code postal et votre ville.</li>
        <li>Votre adresse e-mail et votre numéro de téléphone.</li>
      </ul>
      <p>
        En cas d’erreur, contactez-nous rapidement à{" "}
        <a href="mailto:maison.miroirs@gmail.com">maison.miroirs@gmail.com</a>.
        Une modification ne pourra être garantie une fois la commande préparée
        ou expédiée.
      </p>

      <h2>7. Colis non récupéré en Point Relais</h2>
      <p>
        La cliente est responsable du retrait de son colis dans le délai indiqué
        par le transporteur. Si le colis n’est pas récupéré dans le délai imparti
        et qu’il est retourné à MAISON MIROIR, nous vous invitons à nous
        contacter.
      </p>
      <p>
        Une nouvelle expédition pourra être organisée après accord, avec prise
        en charge des frais de réexpédition par la cliente lorsque le retour lui
        est imputable. Les droits légaux de la cliente restent applicables.
      </p>

      <h2>8. Colis endommagé ou commande non reçue</h2>
      <p>
        Si votre colis arrive endommagé ou si vous constatez une anomalie,
        contactez-nous rapidement à{" "}
        <a href="mailto:maison.miroirs@gmail.com">maison.miroirs@gmail.com</a>.
        Merci de joindre, si possible, des photographies du colis et du produit
        concerné afin de faciliter le traitement de votre demande.
      </p>
      <p>
        En cas de colis indiqué comme livré mais non réceptionné, contactez-nous
        afin que nous puissions effectuer les vérifications nécessaires auprès
        du transporteur. MAISON MIROIR reste responsable de la bonne exécution
        de la commande conformément à la législation applicable.
      </p>

      <h2>9. Retard de livraison</h2>
      <p>
        En cas de retard, consultez votre numéro de suivi et contactez-nous si
        nécessaire. Si la livraison n’intervient pas dans le délai convenu,
        vous bénéficiez des droits prévus par le Code de la consommation,
        notamment la possibilité de demander la livraison dans un délai
        supplémentaire raisonnable puis, dans les conditions légales, de
        résoudre le contrat et d’obtenir un remboursement.
      </p>

      <h2>10. Nous contacter</h2>
      <p>
        Pour toute question concernant votre livraison ou le suivi de votre
        commande, MAISON MIROIR est joignable à{" "}
        <a href="mailto:maison.miroirs@gmail.com">maison.miroirs@gmail.com</a>.
        Le site internet est{" "}
        <a href="https://maison-miroir.fr">https://maison-miroir.fr</a>.
      </p>
      <p>Merci pour votre confiance et pour votre soutien.</p>
      <p>MAISON MIROIR - Chaque commande compte pour nous.</p>
      <p>
        Retrouvez aussi les{" "}
        <Link href="/conditions-de-vente">Conditions générales de vente</Link>{" "}
        et les <Link href="/retours">conditions de retour et remboursement</Link>.
      </p>
    </LegalPage>
  );
}
