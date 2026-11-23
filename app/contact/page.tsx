import Link from "next/link";
import { brandInfo } from "@/lib/brandInfo";

export const metadata = {
  title: "Contact - Maison Miroir",
  description: "Contactez Maison Miroir pour toute question sur la collection.",
};

export default function ContactPage() {
  return (
    <div className="editorial-page">
      <div className="storefront-wrap">
        <p className="storefront-eyebrow">Maison Miroir</p>
        <h1>Contact</h1>
        <p className="editorial-intro">
          Une question sur la première collection ou notre univers ? Écris-nous,
          nous te répondrons dès que possible.
        </p>
        <div className="contact-card">
          <h2>Nous écrire</h2>
          <p>
            <a href={`mailto:${brandInfo.email}`}>{brandInfo.email}</a>
          </p>
          <p>
            Les commandes ne sont pas encore ouvertes. Consulte également la{" "}
            <Link href="/faq">foire aux questions</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
