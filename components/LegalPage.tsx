import Link from "next/link";
import LaunchFooter from "@/components/LaunchFooter";
import "@/app/launch.css";
import "@/app/legal.css";
export default function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="launch legal-shell">
      <main className="legal-content">
        <Link className="legal-back" href="/">
          ← Retour à Maison Miroir
        </Link>
        <p className="legal-eyebrow">MAISON MIROIR</p>
        <h1>{title}</h1>
        <p className="legal-date">Version préparée le 15 novembre 2026</p>
        {children}
      </main>
      <LaunchFooter />
    </div>
  );
}
