import Link from "next/link";
import AdminLogin from "@/components/AdminLogin";
import "../newsletter/newsletter.css";
export const metadata = {
  title: "Administration — Maison Miroir",
  robots: { index: false, follow: false },
};
export default function LoginPage() {
  return (
    <main className="newsletter-page">
      <Link href="/">? Maison Miroir</Link>
      <h1>Votre espace privé</h1>
      <AdminLogin />
    </main>
  );
}
