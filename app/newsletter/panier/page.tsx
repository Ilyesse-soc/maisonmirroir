import NewsletterTokenForm from "@/components/NewsletterTokenForm";
import "../newsletter.css";
export default function CartUnsubscribe() {
  return (
    <main className="newsletter-page">
      <h1>Vos choix, en toute liberté.</h1>
      <p>Confirmez l’arrêt des rappels concernant votre panier.</p>
      <NewsletterTokenForm
        action="/api/cart/unsubscribe"
        label="Ne plus recevoir de rappels"
      />
    </main>
  );
}
