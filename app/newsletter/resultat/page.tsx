import Link from "next/link";
import "../newsletter.css";
export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const messages: Record<string, string> = {
    confirmed:
      "Votre inscription est confirmée. Bienvenue dans la liste privée Maison Miroir.",
    unsubscribed: "Votre désinscription a bien été enregistrée.",
    invalid:
      "Ce lien est invalide, expiré ou déjà utilisé. Vous pouvez renouveler votre demande depuis la page d’accueil.",
    unavailable:
      "Le service est momentanément indisponible. Veuillez réessayer plus tard.",
  };
  const query = await searchParams;
  return (
    <div className="newsletter-page">
      <p>MAISON MIROIR</p>
      <h1>
        {query.status === "confirmed"
          ? "Bienvenue dans notre univers."
          : "Votre liste privée"}
      </h1>
      <p role="status">
        {messages[query.status || "invalid"] || messages.invalid}
      </p>
      <Link href="/">Revenir à Maison Miroir</Link>
    </div>
  );
}
