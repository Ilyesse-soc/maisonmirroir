import NewsletterTokenForm from "@/components/NewsletterTokenForm";
import Link from "next/link";
import "../newsletter.css";
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="newsletter-page">
      <p>MAISON MIROIR</p>
      <h1>Encore un petit pas…</h1>
      <p>
        Confirmez votre souhait de recevoir nos nouveautés, offres et annonces
        de lancement.
      </p>
      <NewsletterTokenForm
        initialToken={query.token || ""}
        action="/api/newsletter/confirmer"
        label="Confirmer mon inscription"
      />
      <Link href="/">Revenir à Maison Miroir</Link>
    </main>
  );
}
