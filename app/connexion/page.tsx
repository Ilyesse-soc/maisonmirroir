import Link from "next/link";
import PasswordLogin from "@/components/PasswordLogin";
import "../newsletter/newsletter.css";
export const metadata = {
  title: "Administration - MAISON MIROIR",
  robots: { index: false, follow: false },
};
export default function LoginPage() {
  return (
    <div className="newsletter-page">
      <Link href="/">? MAISON MIROIR</Link>
      <h1>Votre espace privé</h1>
      <PasswordLogin />
    </div>
  );
}
