import Image from "next/image";
import type { Metadata } from "next";
import NewsletterForm from "@/components/NewsletterForm";
import LaunchFooter from "@/components/LaunchFooter";
import "../launch.css";
import "../launch-fonts.css";

export const metadata: Metadata = {
  title: "MAISON MIROIR - Modesty, Identity, Lifestyle",
  description:
    "For the girls with haya and big dreams. Rejoignez la liste privée MAISON MIROIR et découvrez notre première collection en avant-première.",
  openGraph: {
    title: "MAISON MIROIR - A new chapter begins",
    description: "Une nouvelle vision de la mode, avec élégance et pudeur.",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/launch/reference.jpg",
        width: 1024,
        height: 1536,
        alt: "MAISON MIROIR - nouvelle collection",
      },
    ],
  },
  robots: { index: true, follow: true },
};

export default function NewsletterPage() {
  return (
    <main className="launch">
      <header className="launch-header">
        <div className="brand-line">
          <span />
          <p>MAISON MIROIR</p>
          <span />
        </div>
        <p className="tagline">MODESTY – IDENTITY – LIFESTYLE</p>
      </header>
      <section className="launch-hero" aria-label="La nouvelle Maison Miroir">
        <p className="coming sr-only">Something beautiful is coming...</p>
        <div className="illustration">
          <Image
            width={1024}
            height={1536}
            src="/launch/reference.jpg"
            alt="Deux femmes en tenues pudiques noires portant les sacs Maison Miroir : Just a girl training for Jannah et Modesty is the mood."
            preload
          />
        </div>
      </section>
      <section className="brand-message">
        <p className="chapter">
          <span />A NEW CHAPTER BEGINS
          <span />
        </p>
        <h1>
          For the girls with
          <br />
          haya and big dreams
        </h1>
        <p className="intro">
          Une nouvelle vision de la mode, pensée pour les femmes
          <br className="desktop-break" /> qui souhaitent exprimer leur identité
          avec élégance et pudeur.
        </p>
      </section>
      <section className="private-list" aria-labelledby="newsletter-title">
        <h2 id="newsletter-title">Soyez les premières informées.</h2>
        <p>
          Inscrivez-vous à notre liste privée pour recevoir la date du lancement
          <br className="desktop-break" /> et accéder à notre première
          collection en avant-première.
        </p>
        <NewsletterForm />
        <p className="quiet">
          Aucune actualité inutile. Seulement les informations concernant notre
          lancement.
        </p>
      </section>
      <LaunchFooter />
    </main>
  );
}
