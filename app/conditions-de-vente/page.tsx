import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { getPublicPreparationDays } from "@/lib/publicPreparationDays";
import { CGV_UPDATED_AT } from "@/lib/legalVersion";
import { getBrandSettings } from "@/lib/brandSettings";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Conditions générales de vente - MAISON MIROIR",
  robots: { index: false, follow: true },
};

export default async function SalesTermsPage() {
  const [preparationDays, brand] = await Promise.all([
    getPublicPreparationDays(), getBrandSettings(),
  ]);

  return (
    <LegalPage title="Conditions générales de vente" updatedAt={CGV_UPDATED_AT}>
      <p>
        Les présentes conditions générales de vente s’appliquent aux achats
        réalisés sur le site MAISON MIROIR.{brand.legal_terms_confirmed !== "true" && " Cette version est provisoire et reste soumise à validation juridique."}
      </p>

      <h2>Article 1 - Identification du vendeur</h2>
      <p>
        Le présent site internet, accessible à l’adresse{" "}
        <a href="https://maison-miroir.fr">https://maison-miroir.fr</a>, est
        édité par MAISON MIROIR.
      </p>
      <ul>
        <li>Nom commercial : MAISON MIROIR</li>
        {brand.legal_seller_name && <li>Entrepreneuse individuelle : {brand.legal_seller_name}</li>}
        {brand.professional_phone && <li>Téléphone professionnel : {brand.professional_phone}</li>}
        <li>Statut juridique : Entrepreneur individuel, micro-entreprise</li>
        <li>SIREN : 102 982 576</li>
        <li>SIRET : 102 982 576 00013</li>
        <li>
          Adresse professionnelle : 65 rue d’Aigremont, Appartement 51, 78300
          Poissy, France
        </li>
        <li>
          Adresse e-mail :{" "}
          <a href="mailto:maison.miroirs@gmail.com">maison.miroirs@gmail.com</a>
        </li>
      </ul>
      <p>Ci-après désignée « MAISON MIROIR ».</p>

      <h2>Article 2 - Objet et champ d’application</h2>
      <p>
        Les présentes Conditions Générales de Vente ont pour objet de définir
        les droits et obligations de MAISON MIROIR et de ses clientes dans le
        cadre de la vente de produits sur le site internet. Elles s’appliquent
        à toutes les commandes passées sur le site par des clientes
        particulières. Toute commande implique l’acceptation des présentes
        Conditions Générales de Vente.
      </p>

      <h2>Article 3 - Produits</h2>
      <p>
        MAISON MIROIR propose à la vente des accessoires et articles de mode,
        notamment des tote bags inspirés de l’univers de la modest fashion.
        Chaque produit est présenté avec une description indiquant ses
        caractéristiques essentielles, sa composition, ses dimensions et ses
        particularités.
      </p>
      <p>
        Les photographies et visuels sont présentés avec le plus grand soin. De
        légères différences de couleurs peuvent toutefois apparaître selon les
        écrans utilisés. Les produits sont proposés dans la limite des stocks
        disponibles.
      </p>
      <p>
        En cas d’indisponibilité exceptionnelle après validation d’une commande,
        la cliente en sera informée et pourra obtenir le remboursement des
        sommes versées.
      </p>

      <h2>Article 4 - Prix</h2>
      <p>
        Les prix sont indiqués en euros (€). Les prix affichés sur le site
        correspondent aux prix des produits hors frais de livraison, lesquels
        sont précisés avant la validation définitive de la commande. Le montant
        total à régler est communiqué à la cliente avant le paiement.
      </p>
      <p>
        MAISON MIROIR se réserve le droit de modifier ses tarifs à tout moment.
        Les produits sont néanmoins facturés sur la base des prix affichés au
        moment de la commande. Les éventuelles réductions et offres
        promotionnelles sont soumises aux conditions et à la durée indiquées sur
        le site. Les promotions portent sur les produits et ne réduisent pas
        les frais de livraison.
      </p>

      <h2>Article 5 - Commande</h2>
      <p>
        Les commandes sont réalisées directement sur le site maison-miroir.fr.
        La cliente sélectionne les produits souhaités, les ajoute à son panier,
        renseigne ses coordonnées, choisit son mode de livraison et procède au
        paiement.
      </p>
      <p>
        Avant de confirmer sa commande, elle doit vérifier l’exactitude des
        informations renseignées et le contenu de son panier. Elle doit
        également cocher la case d’acceptation des présentes Conditions
        Générales de Vente. La validation définitive de la commande implique
        une obligation de paiement. Une confirmation de commande est ensuite
        adressée par courrier électronique.
      </p>
      <p>
        MAISON MIROIR se réserve le droit de contacter la cliente en cas de
        difficulté liée à sa commande ou à son paiement.
      </p>

      <h2>Article 6 - Modalités de paiement</h2>
      <p>
        Le paiement est exigible en totalité au moment de la commande. Les
        moyens de paiement acceptés sont ceux proposés sur le site au moment de
        l’achat. La commande est prise en compte après confirmation du paiement.
        En cas de refus ou d’échec du paiement, la commande ne pourra pas être
        expédiée.
      </p>

      <h2>Article 7 - Livraison</h2>
      <p>
        Les modes de livraison proposés sont la livraison en Point Relais
        Mondial Relay et, lorsque le service HOM est autorisé par le contrat de
        production et activé, la livraison à domicile Mondial Relay en France
        métropolitaine. La cliente choisit parmi les modes disponibles sur le
        site.
      </p>
      <ul>
        <li>Point Relais, un sac : 4,10 € TTC.</li>
        <li>Point Relais, deux sacs : 4,54 € TTC.</li>
        <li>
          Domicile, un sac de 500 g : 7,49 € TTC, pour un colis de 30 x 21 x 6
          cm et une destination en France métropolitaine.
        </li>
      </ul>
      <p>
        Pour les quantités dont le tarif ou les caractéristiques du colis ne
        sont pas configurés, aucun tarif n’est inventé et la commande ne peut
        pas être validée. Les frais applicables sont calculés et affichés avant
        le paiement.{" "}
        {preparationDays === null
          ? "Le délai de préparation est temporairement indisponible. Les commandes ne peuvent pas être validées pendant cette indisponibilité."
          : `Le délai de préparation annoncé est de ${preparationDays} jours ouvrés à compter de la confirmation du paiement, hors week-ends et jours fériés.`}{" "}
        Le délai d’acheminement dépend du transporteur et du mode choisi. Le
        délai de préparation s’ajoute au délai d’acheminement.
      </p>
      <p>
        Les colis Mondial Relay sont déposés par MAISON MIROIR. Aucun enlèvement
        à domicile ni aucune collecte n’est planifié. Les commandes sont
        expédiées au Point Relais sélectionné par la cliente ou à l’adresse de
        livraison indiquée lors de la commande. La cliente est responsable de
        l’exactitude des informations de livraison communiquées.
      </p>
      <p>
        En cas d’erreur dans les coordonnées renseignées, MAISON MIROIR ne
        pourra être tenue responsable des conséquences directement liées à
        cette erreur, sans préjudice des obligations légales du vendeur. En cas
        de colis non reçu, perdu ou endommagé, la cliente est invitée à
        contacter MAISON MIROIR afin qu’une solution soit recherchée auprès du
        transporteur.
      </p>
      <p>
        Conformément au Code de la consommation, le risque de perte ou
        d’endommagement du produit est transféré à la cliente au moment où
        elle-même, ou un tiers désigné par elle autre que le transporteur, prend
        physiquement possession du colis. Consultez la{" "}
        <Link href="/livraison">politique de livraison</Link> pour davantage
        d’informations.
      </p>

      <h2>Article 8 - Droit de rétractation</h2>
      <p>
        Conformément aux articles L. 221-18 et suivants du Code de la
        consommation, la cliente dispose d’un délai de 14 jours à compter de la
        réception de sa commande pour exercer son droit de rétractation. Elle
        n’a pas à justifier sa décision ni à payer de pénalité.
      </p>
      <p>
        Pour exercer ce droit, la cliente peut transmettre sa demande par e-mail
        à{" "}
        <a href="mailto:maison.miroirs@gmail.com">maison.miroirs@gmail.com</a>{" "}
        ou utiliser le{" "}
        <Link href="/retractation">formulaire de rétractation en ligne</Link>.
        La demande doit exprimer clairement la volonté de se rétracter et
        identifier la commande concernée. Après réception de la demande,
        MAISON MIROIR adresse un accusé de réception par e-mail.
      </p>
      <p>
        La cliente dispose ensuite de 14 jours supplémentaires pour renvoyer les
        produits concernés. Les frais directs de retour sont à la charge de la
        cliente, sauf si MAISON MIROIR accepte de les prendre en charge ou si
        la réglementation prévoit le contraire.
      </p>

      <h2>Article 9 - Retours et remboursements</h2>
      <p>
        Les produits doivent être retournés dans un état permettant de vérifier
        leur nature, leurs caractéristiques et leur bon fonctionnement. La
        cliente peut manipuler le produit dans la mesure nécessaire pour en
        vérifier la nature et les caractéristiques. Toute dépréciation
        résultant de manipulations allant au-delà de ce qui est nécessaire
        pourra entraîner une retenue proportionnée sur le remboursement, dans
        les conditions prévues par la loi.
      </p>
      <p>
        Après réception du retour, MAISON MIROIR procède à la vérification du
        produit. Le remboursement intervient dans un délai maximum de 14 jours
        à compter de la date à laquelle MAISON MIROIR est informée de la
        décision de rétractation. Il peut être différé jusqu’à récupération du
        produit ou jusqu’à réception d’une preuve de son expédition, la date
        retenue étant celle du premier de ces faits.
      </p>
      <p>
        Le remboursement est effectué avec le même moyen de paiement que celui
        utilisé lors de la commande, sauf accord exprès de la cliente pour un
        autre moyen. En cas de rétractation portant sur la totalité de la
        commande, les frais de livraison standard initiaux sont également
        remboursés. La validation d’un remboursement PayPal reste manuelle.
        Retrouvez la procédure sur la page{" "}
        <Link href="/retours">Retours et remboursements</Link>.
      </p>

      <h2>Article 10 - Garanties légales</h2>
      <p>
        Tous les produits vendus par MAISON MIROIR bénéficient des garanties
        légales applicables.
      </p>
      <h3>Garantie légale de conformité</h3>
      <p>
        Conformément aux articles L. 217-3 et suivants du Code de la
        consommation, la cliente bénéficie d’une garantie légale de conformité
        de deux ans à compter de la délivrance du produit. En cas de défaut de
        conformité, elle peut demander la réparation ou le remplacement du
        produit dans les conditions prévues par la loi. Lorsque ces solutions ne
        sont pas possibles ou dans les autres cas prévus par la réglementation,
        elle peut obtenir une réduction du prix ou la résolution du contrat.
      </p>
      <h3>Garantie contre les vices cachés</h3>
      <p>
        Conformément aux articles 1641 et suivants du Code civil, la cliente
        bénéficie également de la garantie contre les vices cachés. Cette
        garantie permet notamment de demander le remboursement du produit ou
        une réduction du prix lorsque les conditions légales sont réunies. Ces
        garanties s’appliquent indépendamment de toute politique commerciale de
        retour.
      </p>

      <h2>Article 11 - Responsabilité</h2>
      <p>
        MAISON MIROIR s’engage à apporter le soin nécessaire à la préparation
        et à l’expédition des commandes. Sa responsabilité ne pourra être
        engagée en cas d’inexécution ou de mauvaise exécution du contrat
        résultant d’un événement de force majeure reconnu par la loi. Cette
        disposition ne limite pas les droits légaux de la cliente, notamment
        en matière de livraison et de garanties.
      </p>

      <h2>Article 12 - Propriété intellectuelle</h2>
      <p>
        L’ensemble des éléments présents sur le site, notamment les textes,
        photographies, logos, visuels, créations graphiques et éléments de
        présentation, est protégé par les dispositions relatives à la propriété
        intellectuelle. Toute reproduction, représentation ou utilisation,
        totale ou partielle, sans autorisation préalable est interdite.
      </p>

      <h2>Article 13 - Données personnelles</h2>
      <p>
        Les données personnelles collectées lors de la navigation et des
        commandes sont utilisées pour la gestion des achats, des paiements, des
        livraisons et du suivi clientèle. Les données sont traitées
        conformément à la réglementation applicable en matière de protection
        des données personnelles.
      </p>
      <p>
        Pour exercer ses droits ou obtenir davantage d’informations, la
        cliente peut contacter MAISON MIROIR à{" "}
        <a href="mailto:maison.miroirs@gmail.com">maison.miroirs@gmail.com</a>.
        La cliente est également invitée à consulter la{" "}
        <Link href="/politique-de-confidentialite">
          politique de confidentialité
        </Link>
        . Un achat n’entraîne pas l’inscription automatique à la newsletter.
      </p>

      <h2>Article 14 - Réclamations et médiation de la consommation</h2>
      <p>
        Pour toute réclamation relative à une commande, la cliente peut
        contacter MAISON MIROIR par courrier électronique à{" "}
        <a href="mailto:maison.miroirs@gmail.com">maison.miroirs@gmail.com</a>.
        En cas de désaccord persistant après une réclamation écrite préalable,
        la cliente peut recourir gratuitement à un médiateur de la consommation,
        conformément aux conditions légales.
      </p>

      {brand.mediator_name && brand.mediator_address && brand.mediator_url && <p>
        Médiateur de la consommation : {brand.mediator_name}, {brand.mediator_address}.{" "}
        Saisine et modalités : <a href={brand.mediator_url}>{brand.mediator_url}</a>.
      </p>}

      <h2>Article 15 - Droit applicable et litiges</h2>
      <p>
        Les présentes Conditions Générales de Vente sont soumises au droit
        français. En cas de litige, les parties rechercheront prioritairement
        une solution amiable. À défaut d’accord, la cliente pourra saisir les
        juridictions compétentes conformément aux règles applicables en matière
        de consommation.
      </p>

      <h2>Article 16 - Acceptation des Conditions Générales de Vente</h2>
      <p>
        La validation d’une commande sur le site MAISON MIROIR implique la prise
        de connaissance et l’acceptation des présentes Conditions Générales de
        Vente. MAISON MIROIR remercie ses clientes pour leur confiance et leur
        soutien.
      </p>
      <p>MAISON MIROIR - Merci de faire partie de notre histoire.</p>
    </LegalPage>
  );
}
