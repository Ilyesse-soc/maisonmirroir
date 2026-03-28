import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'

type CustomerInfo = {
  firstName: string
  lastName: string
  email: string
  phone?: string
  street: string
  city: string
  zip: string
  country?: string
}

type ProductInfo = {
  id: string
  name: string
  category: string
  categoryLabel?: string
  unitPrice: number
  quantity: number
  message?: string
}

type OrderPayload = {
  product: ProductInfo
  customValues?: Record<string, string>
  customer: CustomerInfo
}

type PaymentMethod = 'PAYPAL' | 'CARD'

type IncomingBody = {
  paymentMethod?: PaymentMethod
  paypalOrderId?: string
  paypalCapture?: unknown
  order: OrderPayload
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

function formatEUR(value: number): string {
  return value.toFixed(2)
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

export async function POST(req: NextRequest) {
  try {
    const rawBody = (await req.json()) as Partial<IncomingBody> & DirectOrderBody

    const paymentMethod = rawBody.paymentMethod
    if (paymentMethod !== 'PAYPAL' && paymentMethod !== 'CARD') {
      return NextResponse.json({ error: 'Missing or invalid paymentMethod' }, { status: 400 })
    }

    const orderId = generateOrderId()

    // Accept both payload formats:
    // 1) current app payload: { order: { product, customValues, customer } }
    // 2) direct form payload: { name, email, phone, product, quantity, price, address, city, postalCode, message }
    let product: ProductInfo | null = null
    let customer: CustomerInfo | null = null
    let customValues: Record<string, string> = {}

    if (rawBody.order && typeof rawBody.order === 'object') {
      const op = rawBody.order as OrderPayload
      product = op.product
      customer = op.customer
      customValues = (op.customValues && typeof op.customValues === 'object' ? op.customValues : {}) as Record<string, string>
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
      customer = {
        firstName: firstName || '',
        lastName: lastName || '',
        email: isNonEmptyString(rawBody.email) ? rawBody.email.trim() : '',
        phone: isNonEmptyString(rawBody.phone) ? rawBody.phone.trim() : undefined,
        street: isNonEmptyString(rawBody.address) ? rawBody.address.trim() : '',
        city: isNonEmptyString(rawBody.city) ? rawBody.city.trim() : '',
        zip: isNonEmptyString(rawBody.postalCode) ? rawBody.postalCode.trim() : '',
        country: 'France',
      }
      customValues = {}
    }

    const validationErrors: string[] = []

    if (!product || !isNonEmptyString(product.name)) validationErrors.push('product is required')
    if (!product || !isPositiveNumber(product.unitPrice)) validationErrors.push('unitPrice must be a positive number')
    if (!product || !isPositiveNumber(product.quantity)) validationErrors.push('quantity must be a positive number')

    if (!customer || !isNonEmptyString(customer.firstName)) validationErrors.push('firstName is required')
    if (!customer || !isValidEmail(customer.email)) validationErrors.push('email is invalid')
    // Phone can be required for direct form; for legacy payloads it's optional.
    if (customer?.phone && !isValidPhone(customer.phone)) validationErrors.push('phone is invalid')
    if (!customer || !isNonEmptyString(customer.street)) validationErrors.push('street is required')
    if (!customer || !isNonEmptyString(customer.city)) validationErrors.push('city is required')
    if (!customer || !isNonEmptyString(customer.zip)) validationErrors.push('postal code is required')

    if (validationErrors.length > 0) {
      return NextResponse.json({ error: 'Invalid input', details: validationErrors }, { status: 400 })
    }

    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 500 })
    }

    const resend = new Resend(resendApiKey)
    const sellerEmail = 'maison.miroirs@gmail.com'
    const fromEmail = 'contact@maison-miroir.fr'

    const total = product.unitPrice * product.quantity

    const safeCustomValues = customValues && typeof customValues === 'object' ? customValues : {}

    const safeCustomerName = `${customer.firstName} ${customer.lastName}`.trim().replace(/\s+/g, ' ')
    const safeTotal = formatEUR(total)
    const subject = `🛒 New Order - ${safeCustomerName} - ${safeTotal}€`

    const baseStyle = 'font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;max-width:640px;margin:0 auto;background:#ffffff;'
    const header = `
      <div style="background:linear-gradient(135deg,#1a1408,#2c2010);padding:26px 24px">
        <div style="color:#e8d08a;font-size:11px;letter-spacing:0.38em;text-transform:uppercase">Maison Miroir</div>
        <div style="color:#ffffff;font-size:18px;font-weight:600;margin-top:6px">Order Notification</div>
      </div>
    `

    const safeMessage = isNonEmptyString(product.message) ? product.message : ''

    const sellerHtml = `
      <div style="${baseStyle}padding:0">
        ${header}
        <div style="padding:22px 24px">
          ${buildSection('Customer Info', [
            ['Name', safeCustomerName],
            ['Email', customer.email],
            ['Phone', customer.phone || ''],
          ])}
          ${buildSection('Order Details', [
            ['Product', product.name],
            ['Quantity', String(product.quantity)],
            ['Unit Price', `${formatEUR(product.unitPrice)} €`],
            ['Total', `${safeTotal} €`],
            ['Payment Method', paymentMethod],
            ['Order ID', orderId],
            ['PayPal Order ID', isNonEmptyString(rawBody.paypalOrderId) ? rawBody.paypalOrderId : ''],
          ])}
          ${buildSection('Shipping Info', [
            ['Address', customer.street],
            ['City', customer.city],
            ['Postal Code', customer.zip],
            ['Country', customer.country || 'France'],
          ])}
          ${buildSection('Message', [["Message", safeMessage]])}
          ${buildSection('Custom Fields', Object.entries(safeCustomValues).map(([k, v]) => [k, String(v)]))}
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
          ${buildSection('Récapitulatif', [
            ['Produit', product.name],
            ['Quantité', String(product.quantity)],
            ['Total', `${safeTotal} €`],
            ['Référence', orderId],
          ])}
          ${buildSection('Livraison', [
            ['Adresse', customer.street],
            ['Ville', customer.city],
            ['Code postal', customer.zip],
            ['Pays', customer.country || 'France'],
          ])}
          <div style="color:#999;font-size:12px;line-height:1.7;margin-top:12px">Si vous avez une question, répondez directement à cet email.</div>
        </div>
      </div>
    `

    const sellerSend = await resend.emails.send({
      from: fromEmail,
      to: [sellerEmail],
      replyTo: customer.email,
      subject,
      html: sellerHtml,
    } as any)

    if ((sellerSend as any)?.error) {
      console.error('[order] seller email failed', (sellerSend as any).error)
      return NextResponse.json({ error: 'Seller email failed' }, { status: 500 })
    }

    // Bonus: customer confirmation (best effort)
    try {
      const customerSend = await resend.emails.send({
        from: fromEmail,
        to: [customer.email],
        replyTo: sellerEmail,
        subject: 'Confirmation de votre commande',
        html: customerHtml,
      } as any)

      if ((customerSend as any)?.error) {
        console.error('[order] customer email failed', (customerSend as any).error)
      }
    } catch (e) {
      console.error(e)
    }

    return NextResponse.json({
      success: true,
      orderId,
      paymentMethod,
      total: safeTotal,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Order failed' }, { status: 500 })
  }
}
