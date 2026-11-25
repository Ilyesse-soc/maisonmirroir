import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { transaction } from "@/lib/newsletterDb";
import { clientIp, mutationAllowed, readJson } from "@/lib/requestSecurity";
import { sendCommerceEmailOnce } from "@/lib/commerceInventory";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    orderId: z.string().regex(/^MM-[0-9]{4}-[A-Z0-9]{8}$/),
    email: z.string().trim().email().max(254),
    confirmRetraction: z.literal(true),
  })
  .strict();

const genericResponse = {
  message:
    "Si les informations correspondent à une commande payée, votre demande est enregistrée et un accusé de réception vous sera envoyé par e-mail.",
};

class RetractionRateLimitError extends Error {}

export async function POST(request: NextRequest) {
  const denied = mutationAllowed(request);
  if (denied) return denied;

  try {
    const body = await readJson(request, requestSchema, 4096);
    const hashSecret =
      process.env.NEWSLETTER_HASH_SECRET ||
      process.env.BETTER_AUTH_SECRET ||
      "";
    if (!hashSecret)
      return NextResponse.json(
        { error: "RETRACTION_SERVICE_UNAVAILABLE" },
        { status: 503 },
      );
    const ipHash = createHash("sha256")
      .update(`${hashSecret}:${clientIp(request)}`)
      .digest("hex");

    const result = await transaction(async (client) => {
      const limit = await client.query<{ count: number }>(
        `INSERT INTO mm_rate_limits(key,count,expires_at)
         VALUES($1,1,now()+interval '1 hour')
         ON CONFLICT(key) DO UPDATE SET
           count=CASE WHEN mm_rate_limits.expires_at < now()
                      THEN 1 ELSE mm_rate_limits.count+1 END,
           expires_at=CASE WHEN mm_rate_limits.expires_at < now()
                           THEN now()+interval '1 hour'
                           ELSE mm_rate_limits.expires_at END
         RETURNING count`,
        [`withdrawal:${ipHash}`],
      );
      if (Number(limit.rows[0]?.count) > 8)
        throw new RetractionRateLimitError();

      const orderResult = await client.query<{
        record: {
          orderId: string;
          orderDate: string;
          customer: { firstName: string; email: string };
        };
      }>(
        `SELECT record FROM mm_orders WHERE order_id=$1 FOR UPDATE`,
        [body.orderId],
      );
      const order = orderResult.rows[0]?.record;
      if (
        !order ||
        order.customer.email.trim().toLowerCase() !== body.email.toLowerCase()
      )
        return null;

      const finance = await client.query<{
        payment_status: string;
        return_status: string;
      }>(
        `SELECT payment_status,return_status
           FROM mm_commerce_order_financials
          WHERE order_id=$1 FOR UPDATE`,
        [body.orderId],
      );
      const paymentStatus = finance.rows[0]?.payment_status;
      const returnStatus = finance.rows[0]?.return_status || "none";
      if (
        !["paid", "partially_refunded"].includes(String(paymentStatus)) ||
        !["none", "requested"].includes(String(returnStatus))
      )
        return null;

      await client.query(
        `INSERT INTO mm_commerce_withdrawal_requests(order_id,status)
         VALUES($1,'received')
         ON CONFLICT(order_id) DO NOTHING`,
        [body.orderId],
      );
      await client.query(
        `UPDATE mm_commerce_order_financials
            SET return_status='requested',
                return_updated_at=COALESCE(return_updated_at,now()),
                withdrawal_requested_at=COALESCE(withdrawal_requested_at,now()),
                updated_at=now()
          WHERE order_id=$1 AND payment_status IN ('paid','partially_refunded')`,
        [body.orderId],
      );
      return order;
    });

    if (!result) return NextResponse.json(genericResponse, { status: 202 });
    await sendCommerceEmailOnce({
      orderId: body.orderId,
      type: "withdrawal_confirmation",
      recipient: result.customer.email,
      subject: `Accusé de réception de votre demande - ${body.orderId}`,
      replyTo: process.env.EMAIL_ADMIN || process.env.OWNER_EMAIL || undefined,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#302017"><header style="background:#21180e;padding:24px;color:#e8d08a;letter-spacing:.2em">MAISON MIROIR</header><main style="padding:24px"><p>Bonjour ${result.customer.firstName.replace(/[<>&"]/g, "")},</p><p>Nous accusons réception de votre demande de rétractation concernant la commande ${body.orderId}.</p><p>Cette confirmation ne vaut pas validation du retour ni déclenchement d’un remboursement. Les modalités sont disponibles sur <a href="https://maison-miroir.fr/retours">la page Retours et remboursements</a>. Pour toute question, écrivez à maison.miroirs@gmail.com.</p><p>MAISON MIROIR</p></main></div>`,
    });
    return NextResponse.json(genericResponse, { status: 202 });
  } catch (error) {
    if (error instanceof RetractionRateLimitError)
      return NextResponse.json(
        { error: "RATE_LIMITED" },
        { status: 429 },
      );
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "INVALID_REQUEST" },
        { status: 400 },
      );
    if (
      error instanceof Error &&
      error.message === "INVALID_REQUEST"
    )
      return NextResponse.json(
        { error: "INVALID_REQUEST" },
        { status: 400 },
      );
    securityEvent("WITHDRAWAL_REQUEST_FAILED");
    return NextResponse.json(
      { error: "RETRACTION_SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
