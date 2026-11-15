import AdminSessionControls from "@/components/AdminSessionControls";
import { adminSession } from "@/lib/adminAuth";
import PasswordLogin from "@/components/PasswordLogin";
import AdminNewsletterPage from "@/app/admin/newsletter/page";
import "../newsletter/newsletter.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Espace privé — Maison Miroir",
  robots: { index: false, follow: false },
};
export default async function AdminEntry() {
  let session = null;
  try {
    session = await adminSession();
  } catch {}
  if (session)
    return (
      <>
        <AdminSessionControls />
        <AdminNewsletterPage />
      </>
    );
  return (
    <main className="newsletter-page">
      <p>MAISON MIROIR</p>
      <h1>Votre espace privé</h1>
      <PasswordLogin />
    </main>
  );
}
