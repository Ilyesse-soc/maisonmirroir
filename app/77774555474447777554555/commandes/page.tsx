import { requireAdminPage } from "@/lib/adminAuth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function AdminOrders() {
  await requireAdminPage();
  redirect("/admin/orders");
}
