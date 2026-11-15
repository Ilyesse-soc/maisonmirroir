import "server-only";
import { randomUUID } from "crypto";
import { database } from "./newsletterDb";
import { adminSession } from "./adminAuth";
export async function adminAudit(action: string, target?: string) {
  const session = await adminSession();
  if (!session) throw new Error("UNAUTHORIZED");
  await database().query(
    "INSERT INTO mm_admin_audit(id,actor_id,action,target_id) VALUES($1,$2,$3,$4)",
    [randomUUID(), session.user.id, action, target || null],
  );
}
