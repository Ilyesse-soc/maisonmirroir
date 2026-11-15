import Link from "next/link";
import { brandInfo } from "@/lib/brandInfo";
export default function LaunchFooter() {
  return (
    <footer className="launch-footer">
      <div className="brand-line">
        <span />
        <p>MAISON MIROIR</p>
        <span />
      </div>
      <p className="signature">Une marque, une identité, une vision</p>
      <div className="social-links">
        <a href={brandInfo.instagram} target="_blank" rel="noopener noreferrer">
          <b aria-hidden="true">◎</b>Notre Instagram
          <span aria-hidden="true">↗</span>
          <span className="sr-only"> (nouvel onglet)</span>
        </a>
        <a href={brandInfo.tiktok} target="_blank" rel="noopener noreferrer">
          <b aria-hidden="true">♪</b>Notre TikTok
          <span aria-hidden="true">↗</span>
          <span className="sr-only"> (nouvel onglet)</span>
        </a>
        <a href={`mailto:${brandInfo.email}`}>
          <b aria-hidden="true">✉</b>
          {brandInfo.email}
          <span aria-hidden="true">→</span>
        </a>
      </div>
      <nav aria-label="Informations légales">
        <Link href="/mentions-legales">Mentions légales</Link>
        <Link href="/politique-de-confidentialite">
          Politique de confidentialité
        </Link>
        <Link href="/politique-de-cookies">Politique de cookies</Link>
      </nav>
      <p className="launch-copyright">
        © {new Date().getFullYear()} Maison Miroir
      </p>
    </footer>
  );
}
