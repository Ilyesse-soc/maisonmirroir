'use client'

import { useMemo, useState } from 'react'
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'
import type { CartAttachment, CartItem } from '@/lib/cart'
import type { CustomerInfo } from '@/lib/orderTypes'
import type { ShippingMethod } from '@/lib/shipping'

export default function CartCheckoutButton({
  items,
  customer,
  shippingMethod,
  attachments = [],
  onSuccess,
}: {
  items: CartItem[]
  customer: CustomerInfo
  shippingMethod: ShippingMethod
  attachments?: CartAttachment[]
  onSuccess?: (orderId: string) => void
}) {
  const clientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? '').trim()
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const subtotal = useMemo(() => items.reduce((total, item) => total + item.unitPrice * item.quantity, 0), [items])
  const total = subtotal + shippingMethod.price

  if (!clientId) {
    return <div style={{ textAlign: 'center', fontSize: 12, opacity: 0.8, lineHeight: 1.7 }}>Configuration requise : définis NEXT_PUBLIC_PAYPAL_CLIENT_ID dans .env.local.</div>
  }

  return (
    <div>
      <PayPalScriptProvider
        options={{
          clientId,
          currency: 'EUR',
          intent: 'capture',
          components: 'buttons',
        }}
      >
        <PayPalButtons
          style={{ layout: 'vertical' }}
          disabled={status === 'processing' || items.length === 0}
          createOrder={(_data, actions) => {
            const totalValue = total.toFixed(2)
            return actions.order.create({
              intent: 'CAPTURE',
              purchase_units: [
                {
                  amount: {
                    currency_code: 'EUR',
                    value: totalValue,
                    breakdown: {
                      item_total: { currency_code: 'EUR', value: subtotal.toFixed(2) },
                      shipping: { currency_code: 'EUR', value: shippingMethod.price.toFixed(2) },
                    },
                  },
                  description: 'Commande panier Maison Miroir',
                  items: items.map((item) => ({
                    name: item.variantLabel ? `${item.name} - ${item.variantLabel}` : item.name,
                    unit_amount: { currency_code: 'EUR', value: item.unitPrice.toFixed(2) },
                    quantity: String(item.quantity),
                    category: 'PHYSICAL_GOODS',
                  })),
                },
              ],
            })
          }}
          onApprove={async (data, actions) => {
            if (status === 'processing') return
            setStatus('processing')
            setErrorMessage('')

            let capture: unknown = null
            try {
              if (!actions.order) throw new Error('PayPal capture unavailable')
              capture = await actions.order.capture()
            } catch {
              setStatus('error')
              setErrorMessage("Le paiement n'a pas pu être capturé. Veuillez réessayer.")
              return
            }

            const sentKey = `mm:orderSent:${data.orderID}`
            const alreadySent = typeof window !== 'undefined' && sessionStorage.getItem(sentKey) === '1'

            if (alreadySent) {
              window.location.href = '/success'
              return
            }

            try {
              const payload = {
                paymentMethod: 'PAYPAL',
                paypalOrderId: data.orderID,
                paypalCapture: capture,
                order: {
                  items: items.map((item) => ({
                    id: item.productId,
                    name: item.variantLabel ? `${item.name} - ${item.variantLabel}` : item.name,
                    category: item.category,
                    categoryLabel: item.categoryLabel,
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                    image: item.image,
                    variantLabel: item.variantLabel,
                  })),
                  product: {
                    id: items[0].productId,
                    name: items[0].name,
                    category: items[0].category,
                    categoryLabel: items[0].categoryLabel,
                    unitPrice: items[0].unitPrice,
                    quantity: items[0].quantity,
                    image: items[0].image,
                    variantLabel: items[0].variantLabel,
                  },
                  shippingMethodId: shippingMethod.id,
                  attachments,
                  customer,
                },
              }

              const res = await fetch('/api/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              })

              if (!res.ok) {
                console.error('[checkout] order api returned non-ok after payment', { status: res.status, paypalOrderId: data.orderID })
              } else {
                const apiData = (await res.json().catch(() => null)) as
                    | { orderId?: string; total?: string; paymentMethod?: string; subtotal?: string; shipping?: string; shippingMethod?: string; shippingDelay?: string; emailWarnings?: string[] }
                  | null

                const orderId = apiData?.orderId || ''
                if (!orderId) throw new Error('Missing orderId from API')

                try {
                  if (typeof window !== 'undefined') sessionStorage.setItem(sentKey, '1')
                } catch {
                  // ignore
                }

                try {
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem(
                      'mm:lastOrder',
                      JSON.stringify({
                        orderId,
                        paymentMethod: apiData?.paymentMethod || 'PAYPAL',
                        product: {
                          id: items[0].productId,
                          name: items[0].name,
                          categoryLabel: items[0].categoryLabel,
                          unitPrice: items[0].unitPrice.toFixed(2),
                          quantity: items[0].quantity,
                          subtotal: apiData?.subtotal || subtotal.toFixed(2),
                          shipping: apiData?.shipping || shippingMethod.price.toFixed(2),
                          total: apiData?.total || total.toFixed(2),
                        },
                        items: items.map((item) => ({
                          id: item.productId,
                          name: item.variantLabel ? `${item.name} - ${item.variantLabel}` : item.name,
                          categoryLabel: item.categoryLabel,
                          unitPrice: item.unitPrice.toFixed(2),
                          quantity: item.quantity,
                          subtotal: (item.unitPrice * item.quantity).toFixed(2),
                        })),
                        shipping: {
                          id: shippingMethod.id,
                          label: shippingMethod.label,
                          shortLabel: shippingMethod.shortLabel,
                          carrier: shippingMethod.carrier,
                          price: shippingMethod.price,
                          estimatedDelay: shippingMethod.estimatedDelay,
                        },
                        customValues: {},
                        address: customer,
                      }),
                    )
                  }
                } catch {
                  // ignore
                }
              }
            } catch (error) {
              console.error('[checkout] order post-payment processing warning', { paypalOrderId: data.orderID, error })
            }

            onSuccess?.(data.orderID)
            window.location.href = '/success'
          }}
          onError={() => {
            setStatus('error')
            setErrorMessage('Erreur PayPal. Veuillez réessayer.')
          }}
          onCancel={() => {
            setStatus('idle')
          }}
        />
      </PayPalScriptProvider>

      {status === 'processing' && <div style={{ marginTop: 10, textAlign: 'center', fontSize: 12, opacity: 0.85, lineHeight: 1.7 }}>Traitement du paiement…</div>}
      {status === 'error' && errorMessage && <div style={{ marginTop: 10, textAlign: 'center', fontSize: 12, color: '#ef4444', lineHeight: 1.7 }}>{errorMessage}</div>}
    </div>
  )
}
