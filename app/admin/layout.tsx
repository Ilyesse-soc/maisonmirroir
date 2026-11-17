import { requireAdminPage } from "@/lib/adminAuth";
import AdminSessionControls from "@/components/AdminSessionControls";
import Link from "next/link";
import "./admin.css";
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();
  return (
    <>
      <AdminSessionControls />
      <div className="admin-shell">
        <aside className="admin-sidebar" aria-label="Navigation administrative">
          <Link className="admin-brand" href="/admin">Maison Miroir</Link>
          <nav>
            <Link href="/admin">Tableau de bord</Link>
            <Link href="/admin/subscribers">Abonnées</Link>
            <Link href="/admin/newsletter">Campagnes</Link>
            <Link href="/admin/miroir-ai">Miroir AI</Link>
            <Link href="/admin/calendar">Calendrier</Link>
            <Link href="/admin/settings">Paramètres</Link>
            <Link href="/admin/orders">Commandes</Link>
          </nav>
        </aside>
        <div className="admin-content">{children}</div>
      </div>
    </>
  );
}
