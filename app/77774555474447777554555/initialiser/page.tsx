import AdminSetup from "@/components/AdminSetup";
import "../../newsletter/newsletter.css";
export const metadata = {
  title: "Initialiser mon espace — Maison Miroir",
  robots: { index: false, follow: false },
};
export default function SetupPage() {
  return (
    <main className="newsletter-page">
      <h1>Bienvenue dans votre espace.</h1>
      <AdminSetup />
    </main>
  );
}
