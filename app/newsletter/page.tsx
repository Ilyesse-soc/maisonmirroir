import type { Metadata } from "next";
import NewsletterForm from "@/components/NewsletterForm";

export const metadata: Metadata = {
  title: "La liste privée - MAISON MIROIR",
  description:
    "Recevez en avant-première la date de lancement et les nouvelles de MAISON MIROIR.",
};

export default function NewsletterPage() {
  return (
    <div className="storefront">
      <section
        className="newsletter-landing"
        aria-labelledby="newsletter-landing-title"
      >
        <div className="storefront-wrap newsletter-landing-inner">
          <div className="newsletter-landing-copy">
            <p className="storefront-eyebrow">La liste privée</p>
            <h1 id="newsletter-landing-title">
              Le lancement, en avant-première.
            </h1>
            <p>
              Recevez la date de lancement et les nouvelles de MAISON MIROIR
              directement dans votre boîte e-mail.
            </p>
          </div>
          <div className="newsletter-landing-form">
            <NewsletterForm />
            <p>
              Votre inscription sera activée après confirmation depuis l’e-mail
              reçu.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
