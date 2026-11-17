import { adminSession } from "@/lib/adminAuth";
import { redirect } from "next/navigation";
import PasswordLogin from "@/components/PasswordLogin";
import AdminSetup from "@/components/AdminSetup";
import { database } from "@/lib/newsletterDb";
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
  if (session) redirect("/admin");
  let needsSetup = false;
  try {
    const result = await database().query(
      "SELECT EXISTS(SELECT 1 FROM mm_admin_setup WHERE singleton=true AND claimed_at IS NULL) AND NOT EXISTS(SELECT 1 FROM mm_auth_user) AS needed",
    );
    needsSetup = result.rows[0]?.needed === true;
  } catch {
    // Remain protected if the initialization state is unavailable.
  }
  return (
    <main className="newsletter-page">
      <p>MAISON MIROIR</p>
      <h1>{needsSetup ? "Créer mon mot de passe" : "Votre espace privé"}</h1>
      {needsSetup ? <AdminSetup /> : <PasswordLogin />}
    </main>
  );
}
