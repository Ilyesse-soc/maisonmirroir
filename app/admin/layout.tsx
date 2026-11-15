import { requireAdminPage } from "@/lib/adminAuth";
import AdminSessionControls from "@/components/AdminSessionControls";
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
      {children}
    </>
  );
}
