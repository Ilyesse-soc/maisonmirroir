export const metadata = {
  title: "FAQ - MAISON MIROIR",
  description:
    "Réponses aux questions fréquentes sur la première collection MAISON MIROIR.",
};

const questions = [
  {
    question: "Quand les commandes ouvriront-elles ?",
    answer:
      "Les commandes ne sont pas encore ouvertes. La disponibilité des produits et les modalités de vente seront précisées avant l’ouverture.",
  },
  {
    question: "Quels sont les délais de préparation et de livraison ?",
    answer:
      "Le délai de préparation, les options de livraison et les délais d’acheminement sont en cours de confirmation. Ils seront publiés avant l’ouverture des commandes.",
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
      "Les frais de livraison, le seuil éventuel de gratuité, les transporteurs et les destinations desservies restent à confirmer. Les informations validées seront publiées avant l’ouverture des commandes.",
  },
  {
    question: "Quels moyens de paiement acceptez-vous ?",
    answer:
      "Les commandes n’étant pas encore ouvertes, aucun paiement n’est actuellement proposé. Les moyens de paiement seront affichés au moment de la commande.",
  },
  {
    question: "Puis-je modifier ou annuler une commande ?",
    answer:
      "Les commandes ne sont pas encore ouvertes. Les modalités de modification et d’annulation seront publiées avant leur ouverture.",
  },
  {
    question: "Puis-je retourner un article ?",
    answer:
      "La politique de retours et les modalités applicables seront publiées avant l’ouverture des commandes.",
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
