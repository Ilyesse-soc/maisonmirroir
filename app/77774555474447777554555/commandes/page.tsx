import { requireAdminPage } from "@/lib/adminAuth";
import OrdersPage from "@/app/admin/page";
export const dynamic = "force-dynamic";
export default async function AdminOrders() {
  await requireAdminPage();
  return <OrdersPage />;
}
