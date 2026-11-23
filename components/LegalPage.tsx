import Link from "next/link";
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
      <div className="legal-content">
        <Link className="legal-back" href="/">
          ← Retour à MAISON MIROIR
        </Link>
        <p className="legal-eyebrow">MAISON MIROIR</p>
        <h1>{title}</h1>
        <p className="legal-date">Informations à valider avant l’ouverture</p>
        {children}
      </div>
    </div>
  );
}
