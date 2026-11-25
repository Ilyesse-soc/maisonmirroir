export const metadata = {
  title: "FAQ - MAISON MIROIR",
  description:
    "Réponses aux questions fréquentes sur la première collection MAISON MIROIR.",
};

const questions = [
  {
    question: "Quand les commandes ouvriront-elles ?",
    answer:
      "La disponibilité de chaque produit est indiquée sur sa fiche. Lorsque la commande est activée, ajoutez les produits souhaités au panier et suivez les étapes du checkout.",
  },
  {
    question: "Quels sont les délais de préparation et de livraison ?",
    answer:
      "La préparation prend 3 jours ouvrés après confirmation du paiement. Les options et frais de livraison applicables sont affichés avant le paiement. Consultez la politique de livraison pour les détails.",
  },
  {
    question: "Où sont confectionnés les sacs ?",
    answer:
      "Les sacs sont confectionnés en Chine auprès d’un fournisseur partenaire. Les produits sont sélectionnés avec attention par MAISON MIROIR.",
  },
  {
    question: "Quelle est la composition des tote bags ?",
    answer:
      "Les tote bags sont en toile 100 % coton, avec un grammage de 340 GSM (12 oz). Ils mesurent 38 × 42 × 15 cm. Les anses sont dans la même toile, ont une largeur de 3 cm et une longueur apparente de 60 cm.",
  },
  {
    question: "Comment entretenir mon tote bag ?",
    answer:
      "Pour préserver le sac et son impression, privilégiez un lavage délicat à la main. Évitez le sèche-linge, les produits blanchissants et le repassage direct sur le motif.",
  },
  {
    question: "La livraison est-elle gratuite ?",
    answer:
      "Les frais dépendent du mode de livraison et de la quantité. Le montant applicable est affiché avant le paiement. Consultez la politique de livraison pour les tarifs communiqués.",
  },
  {
    question: "Quels moyens de paiement acceptez-vous ?",
    answer:
      "Les moyens de paiement disponibles sont indiqués dans le checkout avant la validation de la commande.",
  },
  {
    question: "Puis-je modifier ou annuler une commande ?",
    answer:
      "Contactez MAISON MIROIR dès que possible en indiquant votre numéro de commande. Les possibilités dépendent de l’état de préparation ou d’expédition de la commande.",
  },
  {
    question: "Puis-je retourner un article ?",
    answer:
      "Les modalités de rétractation, de retour et de remboursement sont détaillées dans les pages dédiées du site.",
  },
  {
    question: "Comment contacter MAISON MIROIR ?",
    answer:
      "Pour toute question, écrivez-nous à l’adresse indiquée sur la page Contact. Pour une commande future, indiquez votre numéro de commande si vous en avez un.",
  },
];

export default function FAQPage() {
  return (
    <div className="editorial-page">
      <div className="storefront-wrap">
        <p className="storefront-eyebrow">MAISON MIROIR</p>
        <h1>Foire aux questions</h1>
        <p className="editorial-intro">
          Retrouvez ici les réponses aux questions les plus fréquentes sur nos
          produits et la première collection.
        </p>
        <div className="faq-list">
          {questions.map(({ question, answer }) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
