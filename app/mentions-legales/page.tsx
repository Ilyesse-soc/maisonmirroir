import Link from "next/link";
import "../newsletter/newsletter.css";
export default function LegalPage() {
  return (
    <main className="newsletter-page">
      <Link href="/">← Maison Miroir</Link>
      <h1>Mentions légales</h1>
      <p>Maison Miroir — Modesty, Identity, Lifestyle.</p>
      <p>
        Contact :{" "}
        <a href="mailto:maison.miroirs@gmail.com">maison.miroirs@gmail.com</a>
      </p>
      <p>Cette page de lancement ne propose actuellement aucun achat.</p>
      <p>
        À compléter avant publication : raison sociale ou identité de
        l’éditrice, forme juridique, adresse, immatriculation, numéro de TVA si
        applicable, responsable de publication et coordonnées de l’hébergeur.
        Ces informations ne sont pas encore fournies.
      </p>
    </main>
  );
}
