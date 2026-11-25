import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDenied, adminSession } from "@/lib/adminAuth";
import { adminAudit } from "@/lib/adminAudit";
import { database, transaction } from "@/lib/newsletterDb";
import { InputError, mutationAllowed, readJson } from "@/lib/requestSecurity";
import { getPayPalRefundStatus, paypalRefundConfigured, refundPayPalCapture } from "@/lib/adminPaypalRefund";
import { readOrders } from "@/lib/orderStore";
import { sendCommerceOrderNotification } from "@/lib/commerceNotifications";
import type { OrderRecord } from "@/lib/orderTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

const refundSchema = z.object({
  amountCents: z.number().int().positive().max(100_000_000),
  reason: z.string().trim().min(3).max(240),
  confirmation: z.literal(true),
  idempotencyKey: z.string().uuid(),
}).strict();

type RefundRow = {
  refund_id: string;
  idempotency_key: string;
  order_id: string;
  paypal_capture_id: string;
  paypal_refund_id: string | null;
  amount_cents: number;
  status: "pending" | "unknown" | "completed" | "failed";
  reason: string;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request);
  if (originDenied) {
    originDenied.headers.set("Cache-Control", "no-store");
    return originDenied;
  }
  try {
    const { orderId } = await context.params;
    if (!/^MM-[0-9]{4}-[A-Z0-9]{8}$/.test(orderId))
      return NextResponse.json({ error: "Identifiant de commande invalide." }, { status: 400, headers: noStore });
    const body = await readJson(request, refundSchema, 2048);
    if (!paypalRefundConfigured())
      return NextResponse.json({ error: "La configuration PayPal Live n’est pas complète." }, { status: 503, headers: noStore });
    const session = await adminSession();
    if (!session) return NextResponse.json({ error: "Authentification requise." }, { status: 401, headers: noStore });
    await adminAudit("ORDER_REFUND_REQUESTED", orderId);

    const requestId = body.idempotencyKey.toLowerCase();
    const prepared = await transaction(async (db) => {
      const financeResult = await db.query(
        `SELECT order_id,paypal_capture_id,payment_status,total_cents,refunded_cents
         FROM mm_commerce_order_financials WHERE order_id=$1 FOR UPDATE`,
        [orderId],
      );
      const finance = financeResult.rows[0];
      if (!finance) throw new Error("REFUND_ORDER_NOT_FOUND");
      const existingResult = await db.query(
        "SELECT * FROM mm_commerce_refunds WHERE idempotency_key=$1 FOR UPDATE",
        [requestId],
      );
      const existing = existingResult.rows[0] as RefundRow | undefined;
      if (existing) {
        if (existing.order_id !== orderId || Number(existing.amount_cents) !== body.amountCents)
          throw new Error("REFUND_IDEMPOTENCY_CONFLICT");
        if (existing.status === "completed" || existing.status === "failed")
          return { refund: existing, finance, shouldCall: false, verifyRefundId: null as string | null };
        return {
          refund: existing, finance, shouldCall: true,
          verifyRefundId: existing.status === "pending" ? existing.paypal_refund_id : null,
        };
      }
      if (!["paid", "partially_refunded"].includes(String(finance.payment_status)))
        throw new Error("REFUND_PAYMENT_NOT_REFUNDABLE");
      if (typeof finance.paypal_capture_id !== "string" || !finance.paypal_capture_id)
        throw new Error("REFUND_CAPTURE_MISSING");
      const activeRefund = await db.query(
        `SELECT 1 FROM mm_commerce_refunds
         WHERE order_id=$1 AND status IN ('pending','unknown') LIMIT 1`,
        [orderId],
      );
      if (activeRefund.rowCount) throw new Error("REFUND_PENDING");
      const remaining = Number(finance.total_cents) - Number(finance.refunded_cents);
      if (body.amountCents > remaining) throw new Error("REFUND_AMOUNT_EXCEEDS_BALANCE");
      const refund: RefundRow = {
        refund_id: randomUUID(),
        idempotency_key: requestId,
        order_id: orderId,
        paypal_capture_id: finance.paypal_capture_id,
        paypal_refund_id: null,
        amount_cents: body.amountCents,
        status: "pending",
        reason: body.reason,
      };
      await db.query(
        `INSERT INTO mm_commerce_refunds
          (refund_id,idempotency_key,order_id,paypal_capture_id,amount_cents,status,reason,created_by)
         VALUES($1,$2,$3,$4,$5,'pending',$6,$7)`,
        [refund.refund_id, requestId, orderId, refund.paypal_capture_id,
          refund.amount_cents, refund.reason, session.user.id],
      );
      return { refund, finance, shouldCall: true, verifyRefundId: null as string | null };
    });
    if (!prepared.shouldCall) {
      if (prepared.refund.status === "completed") {
        const order = (await readOrders()).find((item) => item.orderId === orderId) as OrderRecord | undefined;
        if (order) await sendCommerceOrderNotification(order, "refund", prepared.refund.refund_id);
      }
      return NextResponse.json({
        refund: {
          refundId: prepared.refund.paypal_refund_id,
          amountCents: prepared.refund.amount_cents,
          status: prepared.refund.status,
          refundedCents: prepared.finance.refunded_cents,
          paymentStatus: prepared.finance.payment_status,
          idempotentReplay: true,
        },
      }, { headers: noStore });
    }

    let provider;
    try {
      provider = prepared.verifyRefundId
        ? await getPayPalRefundStatus({
          refundId: prepared.verifyRefundId,
          amountCents: prepared.refund.amount_cents,
        })
        : await refundPayPalCapture({
          captureId: prepared.refund.paypal_capture_id,
          amountCents: prepared.refund.amount_cents,
          requestId,
        });
    } catch (error) {
      const uncertain = error instanceof Error && error.message !== "PAYPAL_REFUND_REJECTED";
      await database().query(
        `UPDATE mm_commerce_refunds SET status=$2,error_code=$3,updated_at=now()
         WHERE refund_id=$1 AND status IN ('pending','unknown')`,
        [prepared.refund.refund_id, uncertain ? "unknown" : "failed",
          uncertain ? "PAYPAL_REFUND_UNKNOWN" : "PAYPAL_REFUND_REJECTED"],
      );
      return NextResponse.json(
        { error: uncertain
          ? "État PayPal incertain. Réessayez uniquement avec la même requête."
          : "PayPal a refusé le remboursement. Vérifiez le dossier PayPal avant toute nouvelle demande.",
          retrySameKey: uncertain },
        { status: 502, headers: noStore },
      );
    }

    if (provider.status === "FAILED" || provider.status === "CANCELLED") {
      await database().query(
        `UPDATE mm_commerce_refunds SET status='failed',paypal_refund_id=$2,
          error_code=$3,updated_at=now() WHERE refund_id=$1 AND status IN ('pending','unknown')`,
        [prepared.refund.refund_id, provider.refundId, `PAYPAL_${provider.status}`],
      );
      return NextResponse.json({ error: "PayPal n’a pas confirmé le remboursement.", retrySameKey: false }, { status: 502, headers: noStore });
    }
    if (provider.status === "PENDING") {
      await database().query(
        `UPDATE mm_commerce_refunds SET status='pending',paypal_refund_id=$2,
          updated_at=now() WHERE refund_id=$1 AND status IN ('pending','unknown')`,
        [prepared.refund.refund_id, provider.refundId],
      );
      return NextResponse.json({
        refund: { refundId: provider.refundId, amountCents: provider.amountCents, status: "pending" },
        message: "PayPal traite encore le remboursement. Utilisez le même identifiant pour vérifier à nouveau.",
      }, { status: 202, headers: noStore });
    }

    const result = await transaction(async (db) => {
      const refundRow = (await db.query(
        "SELECT * FROM mm_commerce_refunds WHERE refund_id=$1 FOR UPDATE",
        [prepared.refund.refund_id],
      )).rows[0] as RefundRow;
      const finance = (await db.query(
        `SELECT total_cents,refunded_cents,payment_status
         FROM mm_commerce_order_financials WHERE order_id=$1 FOR UPDATE`,
        [orderId],
      )).rows[0];
      if (refundRow.status !== "completed") {
        const nextRefunded = Number(finance.refunded_cents) + provider.amountCents;
        if (nextRefunded > Number(finance.total_cents))
          throw new Error("REFUND_AMOUNT_EXCEEDS_BALANCE");
        const paymentStatus = nextRefunded === Number(finance.total_cents) ? "refunded" : "partially_refunded";
        await db.query(
          `UPDATE mm_commerce_order_financials SET refunded_cents=$2,payment_status=$3,updated_at=now()
           WHERE order_id=$1`,
          [orderId, nextRefunded, paymentStatus],
        );
        await db.query(
          `UPDATE mm_commerce_refunds SET status='completed',paypal_refund_id=$2,
            error_code=NULL,completed_at=now(),updated_at=now() WHERE refund_id=$1`,
          [refundRow.refund_id, provider.refundId],
        );
        return { refundedCents: nextRefunded, paymentStatus };
      }
      return {
        refundedCents: Number(finance.refunded_cents),
        paymentStatus: String(finance.payment_status),
      };
    });
    const order = (await readOrders()).find((item) => item.orderId === orderId) as OrderRecord | undefined;
    if (order) await sendCommerceOrderNotification(order, "refund", prepared.refund.refund_id);
    return NextResponse.json({
      refund: {
        refundId: provider.refundId, amountCents: provider.amountCents,
        status: "completed", ...result,
      },
    }, { headers: noStore });
  } catch (error) {
    if (error instanceof InputError)
      return NextResponse.json({ error: "Requête invalide." }, { status: error.status, headers: noStore });
    const code = error instanceof Error ? error.message : "";
    const mapped: Record<string, [number, string]> = {
      REFUND_ORDER_NOT_FOUND: [404, "Commande ou dossier financier introuvable."],
      REFUND_IDEMPOTENCY_CONFLICT: [409, "Cette clé a déjà été utilisée avec d’autres paramètres."],
      REFUND_PAYMENT_NOT_REFUNDABLE: [409, "Cette commande n’a pas de paiement remboursable."],
      REFUND_CAPTURE_MISSING: [409, "La capture PayPal vérifiée est absente."],
      REFUND_PENDING: [409, "Un remboursement est déjà en cours ou son état doit être réconcilié."],
      REFUND_AMOUNT_EXCEEDS_BALANCE: [409, "Le montant dépasse le solde remboursable."],
    };
    if (mapped[code]) return NextResponse.json({ error: mapped[code][1] }, { status: mapped[code][0], headers: noStore });
    return NextResponse.json({ error: "Le remboursement n’a pas pu être finalisé." }, { status: 503, headers: noStore });
  }
}
