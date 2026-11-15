import Image from "next/image";
import NewsletterForm from "@/components/NewsletterForm";
import "./launch.css";
import "./launch-fonts.css";
export default function HomePage() {
  const social = [
    { label: "Notre Instagram", icon: "◎", url: process.env.INSTAGRAM_URL },
    { label: "Notre TikTok", icon: "♪", url: process.env.TIKTOK_URL },
  ];
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
        <p className="coming">Something beautiful is coming...</p>
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
      <footer className="launch-footer">
        <div className="brand-line">
          <span />
          <p>MAISON MIROIR</p>
          <span />
        </div>
        <p className="signature">Une marque, une identité, une vision</p>
        <div className="social-links">
          {social.map((s) =>
            s.url ? (
              <a
                href={s.url}
                key={s.label}
                target="_blank"
                rel="noopener noreferrer"
              >
                <b aria-hidden="true">{s.icon}</b>
                {s.label}
                <span aria-hidden="true">→</span>
              </a>
            ) : (
              <span className="social-pending" key={s.label}>
                <b aria-hidden="true">{s.icon}</b>
                {s.label} · bientôt
              </span>
            ),
          )}
          <a href="mailto:maison.miroirs@gmail.com">
            <b aria-hidden="true">✉</b>maison.miroirs@gmail.com
            <span aria-hidden="true">→</span>
          </a>
        </div>
        <nav aria-label="Informations légales">
          <a href="/confidentialite">Confidentialité</a>
          <a href="/mentions-legales">Mentions légales</a>
        </nav>
      </footer>
    </main>
  );
}
