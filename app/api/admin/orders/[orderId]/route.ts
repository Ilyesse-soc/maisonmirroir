import { NextRequest, NextResponse } from 'next/server'
import { readOrders, updateOrder } from '@/lib/orderStore'
import type { OrderStatus } from '@/lib/orderTypes'
import { getAdminEmail, getEmailFrom, sendEmailOrThrow, normalizeEmailError } from '@/lib/email'

const STATUS_VALUES: OrderStatus[] = ['En attente', 'Payee', 'En preparation', 'Expediee', 'Livree', 'Annulee']

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildSection(title: string, rows: Array<[string, string]>) {
  const safeTitle = escapeHtml(title)
  const rowsHtml = rows
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `<tr><td style=\"padding:6px 0;color:#7c6b54;font-size:13px;width:45%\">${escapeHtml(label)}</td><td style=\"padding:6px 0;color:#1f1a12;font-size:13px;font-weight:600\">${escapeHtml(value)}</td></tr>`)
    .join('')

  return `
    <div style=\"border:1px solid #f3e4b8;padding:16px 16px 8px;margin:0 0 12px;background:#fff\">
      <div style=\"font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c9a227;margin:0 0 10px\">${safeTitle}</div>
      <table style=\"width:100%;border-collapse:collapse\">${rowsHtml}</table>
    </div>
  `
}

function logAdminOrderEvent(message: string, meta?: Record<string, unknown>) {
  if (meta) {
    console.log(`[admin/orders] ${message}`, meta)
    return
  }
  console.log(`[admin/orders] ${message}`)
}

function getTrackingLink(carrier: string, fallbackUrl: string) {
  const normalized = carrier.toLowerCase()
  if (normalized.includes('colissimo')) return 'https://www.laposte.fr/outils/suivre-vos-envois'
  if (normalized.includes('mondial relay')) return 'https://www.mondialrelay.fr/suivi-de-colis/'
  if (normalized.includes('chronopost')) return 'https://www.chronopost.fr/tracking-no-cms/suivi-page'
  return fallbackUrl
}

export async function PATCH(req: NextRequest, context: { params: { orderId: string } }) {
  try {
    const { orderId } = context.params
    const body = (await req.json()) as { status?: OrderStatus; trackingNumber?: string }

    const nextStatus = body.status
    const nextTracking = isNonEmptyString(body.trackingNumber) ? body.trackingNumber.trim() : ''

    if (nextStatus && !STATUS_VALUES.includes(nextStatus)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    const orders = await readOrders()
    const existing = orders.find((order) => order.orderId === orderId)
    if (!existing) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    const patch: Record<string, unknown> = {}
    if (nextStatus) patch.status = nextStatus
    if (nextTracking) {
      patch.trackingNumber = nextTracking
      patch.trackingUrl = getTrackingLink(existing.shipping.carrier, existing.shipping.trackingBaseUrl)
    }

    const updated = await updateOrder(orderId, patch)
    if (!updated) {
      return NextResponse.json({ error: 'Mise a jour impossible' }, { status: 500 })
    }

    logAdminOrderEvent('commande mise à jour', { orderId, status: nextStatus || updated.status, trackingNumber: nextTracking || updated.trackingNumber || '' })

    const fromEmail = getEmailFrom()
    const adminEmail = getAdminEmail()
    if (fromEmail && adminEmail) {
      try {
        const baseStyle = 'font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;max-width:640px;margin:0 auto;background:#ffffff;'
        const trackingUrl = updated.trackingNumber
          ? getTrackingLink(updated.shipping.carrier, updated.trackingUrl || updated.shipping.trackingBaseUrl)
          : updated.trackingUrl || updated.shipping.trackingBaseUrl

        const customerHtml = `
          <div style=\"${baseStyle}padding:0\">
            <div style=\"background:linear-gradient(135deg,#1a1408,#2c2010);padding:24px\">
              <div style=\"color:#e8d08a;font-size:11px;letter-spacing:0.3em;text-transform:uppercase\">Maison Miroir</div>
              <div style=\"color:#fff;font-size:18px;font-weight:600;margin-top:6px\">Mise a jour de votre commande #${escapeHtml(updated.orderId)}</div>
            </div>
            <div style=\"padding:20px 24px\">
              <div style=\"font-size:14px;color:#1f1a12;line-height:1.8;margin-bottom:12px\">Bonjour ${escapeHtml(updated.customer.firstName)}, votre commande a ete mise a jour.</div>
              ${buildSection('Etat de commande', [
                ['Numero de commande', updated.orderId],
                ['Nouveau statut', updated.status],
                ['Transporteur', updated.shipping.carrier],
                ['Mode de livraison', updated.shipping.label],
                ['Numero de suivi', updated.trackingNumber || ''],
                ['Lien de suivi', trackingUrl],
                ['Delai estime restant', updated.shipping.estimatedDelay],
              ])}
              ${buildSection('Resume', [
                ['Sous-total produits', `${updated.subtotal.toFixed(2)} EUR`],
                ['Livraison', `${updated.shipping.price.toFixed(2)} EUR`],
                ['Total paye', `${updated.total.toFixed(2)} EUR`],
              ])}
              <div style=\"color:#999;font-size:12px;line-height:1.7\">Vous recevrez un nouvel email a chaque etape cle de votre commande.</div>
            </div>
          </div>
        `

        await sendEmailOrThrow({
          from: fromEmail,
          to: updated.customer.email,
          replyTo: adminEmail,
          subject: `Mise a jour commande - #${updated.orderId}`,
          html: customerHtml.replace('[' + 'updated.trackingUrl || updated.shipping.trackingBaseUrl' + ']', trackingUrl),
        })
        logAdminOrderEvent('email suivi envoyé', { orderId, to: updated.customer.email })
      } catch (emailError) {
        const message = normalizeEmailError(emailError)
        console.error('[admin/orders] email update failed', { orderId, error: message })
      }
    }

    return NextResponse.json({ success: true, order: updated })
  } catch {
    return NextResponse.json({ error: 'Echec de mise a jour' }, { status: 500 })
  }
}
