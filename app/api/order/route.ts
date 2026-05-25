import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { saveOrder } from '@/lib/orderStore'
import type { CustomerInfo, OrderPayload, OrderRecord, PaymentMethod, ProductInfo } from '@/lib/orderTypes'
import { formatEuro, getShippingMethodById } from '@/lib/shipping'
import { getAdminEmail, getEmailFrom, normalizeEmailError, sendEmailOrThrow } from '@/lib/email'

type IncomingBody = {
  paymentMethod?: PaymentMethod
  paypalOrderId?: string
  paypalCapture?: unknown
  order: OrderPayload
}

function isSafeBase64(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(value)
}

type DirectOrderBody = {
  name?: string
  email?: string
  phone?: string
  product?: string
  quantity?: number
  price?: number
  address?: string
  city?: string
  postalCode?: string
  message?: string
  shippingMethodId?: string
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidEmail(value: unknown): value is string {
  return isNonEmptyString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function isValidPhone(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false
  const normalized = value.replace(/[\s().-]/g, '')
  return /^\+?[0-9]{8,15}$/.test(normalized)
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function generateOrderId(now = new Date()): string {
  const year = now.getFullYear()
  const suffix = randomUUID().split('-')[0].toUpperCase()
  return `MM-${year}-${suffix}`
}

function buildSection(title: string, rows: Array<[string, string]>): string {
  const safeTitle = escapeHtml(title)
  const rowsHtml = rows
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => {
      const key = escapeHtml(k)
      const val = escapeHtml(v)
      return `<tr><td style="padding:7px 0;color:#7c6b54;font-size:13px;width:40%">${key}</td><td style="padding:7px 0;color:#1f1a12;font-size:13px;font-weight:600">${val}</td></tr>`
    })
    .join('')

  return `
    <div style="border:1px solid #f3e4b8;padding:18px 18px 10px;margin:0 0 14px;background:#fff">
      <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#c9a227;margin:0 0 10px">${safeTitle}</div>
      <table style="width:100%;border-collapse:collapse">${rowsHtml || '<tr><td style="font-size:13px;color:#999">—</td></tr>'}</table>
    </div>
  `
}

function logOrderEvent(message: string, meta?: Record<string, unknown>) {
  if (meta) {
    console.log(`[order] ${message}`, meta)
    return
  }
  console.log(`[order] ${message}`)
}

function sanitizeProviderResponse(value: unknown) {
  if (!value || typeof value !== 'object') return value
  const source = value as Record<string, unknown>
  return {
    id: source.id,
    data: source.data,
    error: source.error,
  }
}

function formatUnknownError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
  return { raw: error }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = (await req.json()) as Partial<IncomingBody> & DirectOrderBody

    const paymentMethod = rawBody.paymentMethod
    if (paymentMethod !== 'PAYPAL' && paymentMethod !== 'CARD') {
      return NextResponse.json({ error: 'Missing or invalid paymentMethod' }, { status: 400 })
    }

    logOrderEvent('paiement validé', {
      paymentMethod,
      paypalOrderId: isNonEmptyString(rawBody.paypalOrderId) ? rawBody.paypalOrderId : null,
      hasPaypalCapture: Boolean(rawBody.paypalCapture),
    })

    const orderId = generateOrderId()

    // Accept both payload formats:
    // 1) current app payload: { order: { product, customValues, customer } }
    // 2) direct form payload: { name, email, phone, product, quantity, price, address, city, postalCode, message }
    let product: ProductInfo | null = null
    let items: ProductInfo[] = []
    let customer: CustomerInfo | null = null
    let customValues: Record<string, string> = {}
    let attachments: Array<{ filename: string; contentType: string; base64: string }> = []
    let shippingMethodId = ''

    if (rawBody.order && typeof rawBody.order === 'object') {
      const op = rawBody.order as OrderPayload
      product = op.product
      items = Array.isArray((op as any).items) && (op as any).items.length > 0 ? (op as any).items : [op.product]
      customer = op.customer
      customValues = (op.customValues && typeof op.customValues === 'object' ? op.customValues : {}) as Record<string, string>
      shippingMethodId = isNonEmptyString(op.shippingMethodId) ? op.shippingMethodId : ''
      const atts = Array.isArray(op.attachments) ? op.attachments : []
      attachments = atts
        .filter((a) => a && typeof a === 'object')
        .map((a) => ({
          filename: typeof (a as any).filename === 'string' ? (a as any).filename : '',
          contentType: typeof (a as any).contentType === 'string' ? (a as any).contentType : '',
          base64: typeof (a as any).base64 === 'string' ? (a as any).base64 : '',
        }))
    } else {
      const name = isNonEmptyString(rawBody.name) ? rawBody.name.trim() : ''
      const [firstName, ...rest] = name.split(' ')
      const lastName = rest.join(' ')

      if (!isPositiveNumber(rawBody.price)) {
        return NextResponse.json({ error: 'Missing or invalid price' }, { status: 400 })
      }
      if (!isPositiveNumber(rawBody.quantity)) {
        return NextResponse.json({ error: 'Missing or invalid quantity' }, { status: 400 })
      }

      product = {
        id: 'custom',
        name: isNonEmptyString(rawBody.product) ? rawBody.product.trim() : 'Commande',
        category: 'custom',
        categoryLabel: 'Commande',
        unitPrice: rawBody.price,
        quantity: rawBody.quantity,
        message: isNonEmptyString(rawBody.message) ? rawBody.message.trim() : undefined,
      }
      items = [product]
      customer = {
        firstName: firstName || '',
        lastName: lastName || '',
        email: isNonEmptyString(rawBody.email) ? rawBody.email.trim() : '',
        phone: isNonEmptyString(rawBody.phone) ? rawBody.phone.trim() : '',
        street: isNonEmptyString(rawBody.address) ? rawBody.address.trim() : '',
        city: isNonEmptyString(rawBody.city) ? rawBody.city.trim() : '',
        zip: isNonEmptyString(rawBody.postalCode) ? rawBody.postalCode.trim() : '',
        country: 'France',
      }
      shippingMethodId = isNonEmptyString(rawBody.shippingMethodId) ? rawBody.shippingMethodId.trim() : ''
      customValues = {}
      attachments = []
    }

    const validationErrors: string[] = []

    if (!product || !isNonEmptyString(product.name)) validationErrors.push('product is required')
    if (!product || !isPositiveNumber(product.unitPrice)) validationErrors.push('unitPrice must be a positive number')
    if (!product || !isPositiveNumber(product.quantity)) validationErrors.push('quantity must be a positive number')
    if (!Array.isArray(items) || items.length === 0) validationErrors.push('items are required')

    const normalizedItems = (Array.isArray(items) ? items : [])
      .filter((item): item is ProductInfo => Boolean(item && isNonEmptyString(item.name) && isPositiveNumber(item.unitPrice) && isPositiveNumber(item.quantity)))

    if (normalizedItems.length === 0) validationErrors.push('items are invalid')

    if (!customer || !isNonEmptyString(customer.firstName)) validationErrors.push('firstName is required')
    if (!customer || !isValidEmail(customer.email)) validationErrors.push('email is invalid')
    if (!customer || !isNonEmptyString(customer.phone)) validationErrors.push('phone is required')
    if (customer?.phone && !isValidPhone(customer.phone)) validationErrors.push('phone is invalid')
    if (!customer || !isNonEmptyString(customer.street)) validationErrors.push('street is required')
    if (!customer || !isNonEmptyString(customer.city)) validationErrors.push('city is required')
    if (!customer || !isNonEmptyString(customer.zip)) validationErrors.push('postal code is required')
    if (!isNonEmptyString(shippingMethodId)) validationErrors.push('shipping method is required')

    const shippingMethod = isNonEmptyString(shippingMethodId) ? getShippingMethodById(shippingMethodId) : null
    if (!shippingMethod) validationErrors.push('shipping method is invalid')

    if (validationErrors.length > 0) {
      return NextResponse.json({ error: 'Invalid input', details: validationErrors }, { status: 400 })
    }

    const fromEmail = getEmailFrom()
    const adminEmail = getAdminEmail()
    const hasResendApiKey = Boolean((process.env.RESEND_API_KEY || '').trim())
    const isFromEmailValid = isValidEmail(fromEmail)
    const isAdminEmailValid = isValidEmail(adminEmail)
    logOrderEvent('diagnostic config email', {
      provider: 'resend',
      hasResendApiKey,
      hasEmailFrom: Boolean((process.env.EMAIL_FROM || '').trim()),
      hasResendFrom: Boolean((process.env.RESEND_FROM || '').trim()),
      hasOwnerEmail: Boolean((process.env.OWNER_EMAIL || '').trim()),
      hasEmailAdmin: Boolean((process.env.EMAIL_ADMIN || '').trim()),
      resolvedFromEmail: fromEmail || null,
      resolvedAdminEmail: adminEmail || null,
      isFromEmailValid,
      isAdminEmailValid,
    })

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    const shippingPrice = shippingMethod?.price ?? 0
    const total = subtotal + shippingPrice

    const safeCustomValues = customValues && typeof customValues === 'object' ? customValues : {}

    const safeAttachments = attachments
      .filter((a) => isNonEmptyString(a.filename) && isNonEmptyString(a.contentType) && isSafeBase64(a.base64))
      .slice(0, 2)
      .filter((a) => {
        const allowedTypes = ['application/pdf', 'image/png']
        if (!allowedTypes.includes(a.contentType)) return false

        // Approx bytes = base64 length * 3/4
        const approxBytes = Math.floor(a.base64.replace(/\s/g, '').length * 0.75)
        return approxBytes > 0 && approxBytes <= 2 * 1024 * 1024
      })

    const safeCustomerName = `${customer.firstName} ${customer.lastName}`.trim().replace(/\s+/g, ' ')
    const subject = `Nouvelle commande reçue – #${orderId}`
    const orderDate = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

    const baseStyle = 'font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;max-width:640px;margin:0 auto;background:#ffffff;'
    const header = `
      <div style="background:linear-gradient(135deg,#1a1408,#2c2010);padding:26px 24px">
        <div style="color:#e8d08a;font-size:11px;letter-spacing:0.38em;text-transform:uppercase">Maison Miroir</div>
        <div style="color:#ffffff;font-size:18px;font-weight:600;margin-top:6px">Order Notification</div>
      </div>
    `

    const safeMessage = isNonEmptyString(product.message) ? product.message : ''

    const itemsHtml = normalizedItems
      .map(
        (item) => `
          <tr>
            <td style="padding:8px 0;color:#1f1a12;font-size:13px;font-weight:600">${escapeHtml(item.name)}</td>
            <td style="padding:8px 0;color:#7c6b54;font-size:13px">${item.quantity}</td>
            <td style="padding:8px 0;color:#7c6b54;font-size:13px">${formatEuro(item.unitPrice)} EUR</td>
            <td style="padding:8px 0;color:#1f1a12;font-size:13px;font-weight:600;text-align:right">${formatEuro(item.unitPrice * item.quantity)} EUR</td>
          </tr>
        `,
      )
      .join('')

    const sellerHtml = `
      <div style="${baseStyle}padding:0">
        ${header}
        <div style="padding:22px 24px">
          ${buildSection('Commande', [
            ['Numero de commande', orderId],
            ['Date de commande', orderDate],
            ['Statut', 'Payee'],
            ['Mode de paiement', paymentMethod],
            ['PayPal Order ID', isNonEmptyString(rawBody.paypalOrderId) ? rawBody.paypalOrderId : ''],
          ])}
          ${buildSection('Client', [
            ['Prenom', customer.firstName],
            ['Nom', customer.lastName],
            ['Email', customer.email],
            ['Telephone', customer.phone || ''],
          ])}
          ${buildSection('Livraison', [
            ['Adresse', customer.street],
            ['Ville', customer.city],
            ['Code postal', customer.zip],
            ['Pays', customer.country || 'France'],
            ['Mode choisi', shippingMethod?.label || ''],
            ['Prix de livraison', `${formatEuro(shippingPrice)}`],
            ['Delai estime', shippingMethod?.estimatedDelay || ''],
            ['Numero de suivi', 'Non disponible'],
          ])}
          <div style="border:1px solid #f3e4b8;padding:18px 18px 10px;margin:0 0 14px;background:#fff">
            <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#c9a227;margin:0 0 10px">Produits commandes</div>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr>
                  <th style="text-align:left;padding:0 0 8px;color:#7c6b54;font-size:11px;letter-spacing:0.18em;text-transform:uppercase">Produit</th>
                  <th style="text-align:left;padding:0 0 8px;color:#7c6b54;font-size:11px;letter-spacing:0.18em;text-transform:uppercase">Qté</th>
                  <th style="text-align:left;padding:0 0 8px;color:#7c6b54;font-size:11px;letter-spacing:0.18em;text-transform:uppercase">PU</th>
                  <th style="text-align:right;padding:0 0 8px;color:#7c6b54;font-size:11px;letter-spacing:0.18em;text-transform:uppercase">Sous-total</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          </div>
          ${buildSection('Totaux', [
            ['Sous-total', `${formatEuro(subtotal)}`],
            ['Livraison', `${formatEuro(shippingPrice)}`],
            ['Total final TTC', `${formatEuro(total)}`],
          ])}
          ${buildSection(
            'Personnalisation / Message',
            [["Message", safeMessage], ...Object.entries(safeCustomValues).map(([k, v]) => [k, String(v)] as [string, string])]
          )}
          <div style="color:#999;font-size:12px;line-height:1.7;margin-top:12px">Reply to this email to contact the customer.</div>
        </div>
      </div>
    `

    const customerHtml = `
      <div style="${baseStyle}padding:0">
        <div style="background:linear-gradient(135deg,#1a1408,#2c2010);padding:26px 24px;text-align:center">
          <div style="color:#e8d08a;font-size:11px;letter-spacing:0.38em;text-transform:uppercase">Maison Miroir</div>
          <div style="color:#ffffff;font-size:18px;font-weight:600;margin-top:6px">Confirmation de commande</div>
        </div>
        <div style="padding:22px 24px">
          <div style="font-size:14px;color:#1f1a12;line-height:1.8;margin-bottom:14px">Bonjour ${escapeHtml(customer.firstName)}, merci pour votre commande.</div>
          <div style="font-size:14px;color:#1f1a12;line-height:1.8;margin-bottom:14px">
            Merci pour votre commande.<br />
            Votre commande #${escapeHtml(orderId)} a bien ete enregistree.<br />
            Vous avez choisi : ${escapeHtml(shippingMethod?.label || '')}.<br />
            Delai estime : ${escapeHtml(shippingMethod?.estimatedDelay || '')}.<br />
            Vous recevrez un email avec votre numero de suivi des l'expedition.
          </div>
          ${buildSection('Récapitulatif', [
            [
              'Detail commande',
              normalizedItems.map((item) => `${item.name} x${item.quantity}`).join(' | '),
            ],
            ['Nombre d\'articles', String(normalizedItems.length)],
            ['Sous-total', `${formatEuro(subtotal)}`],
            ['Livraison', `${formatEuro(shippingPrice)}`],
            ['Total paye', `${formatEuro(total)}`],
            ['Référence', orderId],
          ])}
          ${buildSection('Personnalisation', Object.entries(safeCustomValues).map(([k, v]) => [k, String(v)]))}
          ${buildSection('Livraison', [
            ['Adresse', customer.street],
            ['Ville', customer.city],
            ['Code postal', customer.zip],
            ['Pays', customer.country || 'France'],
            ['Mode de livraison', shippingMethod?.label || ''],
            ['Prix de livraison', `${formatEuro(shippingPrice)}`],
            ['Delai estime de reception', shippingMethod?.estimatedDelay || ''],
          ])}
          <div style="color:#999;font-size:12px;line-height:1.7;margin-top:12px">Si vous avez une question, répondez directement à cet email.</div>
        </div>
      </div>
    `

    const orderRecord: OrderRecord = {
      orderId,
      orderDate: new Date().toISOString(),
      paymentMethod,
      paypalOrderId: isNonEmptyString(rawBody.paypalOrderId) ? rawBody.paypalOrderId : undefined,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone || '',
        street: customer.street,
        city: customer.city,
        zip: customer.zip,
        country: customer.country || 'France',
      },
      items: normalizedItems,
      customValues: safeCustomValues,
      shipping: {
        id: shippingMethod?.id || shippingMethodId,
        label: shippingMethod?.label || '',
        shortLabel: shippingMethod?.shortLabel || '',
        carrier: shippingMethod?.carrier || 'Mondial Relay',
        price: shippingPrice,
        estimatedDelay: shippingMethod?.estimatedDelay || '',
        trackingBaseUrl: shippingMethod?.trackingBaseUrl || '',
      },
      subtotal,
      total,
      status: 'Payee',
    }

    await saveOrder(orderRecord)
    logOrderEvent('commande créée', { orderId, paymentMethod, total: total.toFixed(2) })

    const emailWarnings: string[] = []

    if (!hasResendApiKey || !fromEmail || !isFromEmailValid) {
      const message = 'email skipped: resend configuration incomplete or invalid sender'
      emailWarnings.push(message)
      console.error('[order] email skipped', {
        orderId,
        hasResendApiKey,
        hasFromEmail: Boolean(fromEmail),
        isFromEmailValid,
      })
    } else {
      if (!isAdminEmailValid) {
        const message = 'seller email skipped: admin recipient missing or invalid'
        emailWarnings.push(message)
        console.error('[order] email vendeur skipped', {
          orderId,
          adminEmail: adminEmail || null,
          isAdminEmailValid,
        })
      } else {
        try {
          logOrderEvent('tentative email vendeur', { orderId, from: fromEmail, to: adminEmail, provider: 'resend' })
          const sellerResult = await sendEmailOrThrow({
            from: fromEmail,
            to: adminEmail,
            replyTo: customer.email,
            subject,
            html: sellerHtml,
            attachments: safeAttachments.map((a) => ({
              filename: a.filename,
              content: a.base64.replace(/\s/g, ''),
              contentType: a.contentType,
            })),
          })
          logOrderEvent('reponse fournisseur email vendeur', { orderId, response: sanitizeProviderResponse(sellerResult) })
          logOrderEvent('email vendeur envoyé', { orderId, to: adminEmail })
        } catch (error) {
          const message = normalizeEmailError(error)
          emailWarnings.push(`seller: ${message}`)
          console.error('[order] email vendeur failed', {
            orderId,
            error: message,
            detail: formatUnknownError(error),
          })
        }
      }

      try {
        logOrderEvent('tentative email client', { orderId, from: fromEmail, to: customer.email, provider: 'resend' })
        const customerResult = await sendEmailOrThrow({
          from: fromEmail,
          to: customer.email,
          replyTo: isAdminEmailValid ? adminEmail : undefined,
          subject: `Confirmation de votre commande - #${orderId}`,
          html: customerHtml,
        })
        logOrderEvent('reponse fournisseur email client', { orderId, response: sanitizeProviderResponse(customerResult) })
        logOrderEvent('email client envoyé', { orderId, to: customer.email })
      } catch (e) {
        const message = normalizeEmailError(e)
        emailWarnings.push(`customer: ${message}`)
        console.error('[order] email client failed', {
          orderId,
          error: message,
          detail: formatUnknownError(e),
        })
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      paymentMethod,
      subtotal: subtotal.toFixed(2),
      shipping: shippingPrice.toFixed(2),
      total: total.toFixed(2),
      shippingMethod: shippingMethod?.label || '',
      shippingDelay: shippingMethod?.estimatedDelay || '',
      emailWarnings,
    })
  } catch (err) {
    console.error('[order] order processing failed', formatUnknownError(err))
    return NextResponse.json({ error: 'Order failed' }, { status: 500 })
  }
}
