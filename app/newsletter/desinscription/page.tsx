import NewsletterTokenForm from "@/components/NewsletterTokenForm";
import Link from "next/link";
import "../newsletter.css";
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const query = await searchParams;
  return (
    <div className="newsletter-page">
      <p>MAISON MIROIR</p>
      <h1>À votre rythme.</h1>
      <p>Vous pouvez quitter notre liste privée à tout moment.</p>
      <NewsletterTokenForm
        initialToken={query.token || ""}
        action="/api/newsletter/desinscription"
        label="Me désinscrire"
      />
      <Link href="/">Revenir à Maison Miroir</Link>
    </div>
  );
}
