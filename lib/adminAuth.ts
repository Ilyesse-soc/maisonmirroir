import "server-only";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
export async function adminSession() {
  const allowed = (
    process.env.ADMIN_EMAIL ||
    process.env.EMAIL_ADMIN ||
    process.env.OWNER_EMAIL ||
    ""
  )
    .trim()
    .toLowerCase();
  if (!allowed) return null;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session || session.user.email.toLowerCase() !== allowed) return null;
  return session;
}
export async function adminDenied() {
  try {
    if (await adminSession()) return null;
  } catch {}
  return NextResponse.json(
    { error: "Authentification requise" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
export async function requireAdminPage() {
  try {
    if (await adminSession()) return;
  } catch {}
  redirect("/77774555474447777554555");
}
