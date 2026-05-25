/* eslint-disable react/no-unescaped-entities */
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { buttonGoldStyle, buttonOutlineGoldStyle, dividerStyle, fonts, theme } from '@/lib/uiStyles'

type LastOrder = {
  orderId: string
  paymentMethod: 'PAYPAL' | 'CARD'
  paypalOrderId?: string
  product: { id: string; name: string; categoryLabel?: string; unitPrice: string; quantity: number; subtotal: string; shipping: string; total: string }
  items?: Array<{ id: string; name: string; categoryLabel?: string; unitPrice: string; quantity: number; subtotal: string }>
  shipping: {
    id: string
    label: string
    shortLabel: string
    carrier: string
    price: number
    estimatedDelay: string
  }
  customValues?: Record<string, string>
  address: {
    firstName: string
    lastName: string
    email: string
    phone: string
    street: string
    city: string
    zip: string
    country?: string
  }
}

export default function SuccessPage() {
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('mm:lastOrder')
      if (!raw) return
      const parsed = JSON.parse(raw) as LastOrder
      if (parsed && parsed.orderId && parsed.address?.email) setLastOrder(parsed)
    } catch {
      // ignore
    }
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        background: theme.marble,
      }}
    >
      <div style={{ maxWidth: 512, width: '100%', textAlign: 'center', padding: '80px 0' }}>
        {/* Icon */}
        <div
          className="mm-success-icon"
          style={{
            width: 80,
            height: 80,
            borderRadius: '999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px',
            fontSize: 28,
            background: `linear-gradient(135deg, ${theme.gold}, ${theme.goldLight})`,
            color: 'white',
          }}
        >
          ✓
        </div>

        <p style={{ fontFamily: fonts.display, fontSize: 12, letterSpacing: '0.40em', textTransform: 'uppercase', marginBottom: 16, color: theme.gold }}>
          Commande confirmée
        </p>

        <h1 style={{ fontFamily: fonts.display, fontSize: 'clamp(2.2rem, 5vw, 3.2rem)', fontWeight: 300, marginBottom: 16, color: theme.textDark }}>
          Merci pour votre commande
        </h1>

        <div style={{ ...dividerStyle(60), margin: '24px auto' }} />

        <p style={{ fontSize: 14, lineHeight: 1.8, fontFamily: fonts.body, letterSpacing: '0.04em', marginBottom: 16, color: theme.textMid }}>
          Votre commande a bien été enregistrée. Un email de confirmation vous sera envoyé sous quelques instants.
        </p>

        {lastOrder && (
          <div
            style={{
              margin: '28px 0 10px',
              textAlign: 'left',
              background: 'white',
              border: `1px solid ${theme.creamDark}`,
              padding: 18,
            }}
          >
            <p
              style={{
                fontFamily: fonts.body,
                fontSize: 11,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: theme.gold,
                margin: 0,
              }}
            >
              Résumé de commande
            </p>
            <div style={{ ...dividerStyle(80), margin: '14px 0 16px' }} />

            <div style={{ display: 'grid', gap: 10, fontFamily: fonts.body, fontSize: 13, color: theme.textMid, letterSpacing: '0.03em' }}>
              <div>
                <span style={{ color: theme.textDark }}>Produit :</span> {lastOrder.product.name}
              </div>
              {lastOrder.items && lastOrder.items.length > 1 && (
                <div>
                  <div style={{ color: theme.textDark, marginBottom: 6 }}>Articles :</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {lastOrder.items.map((item) => (
                      <div key={item.id + item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ color: theme.textMid }}>
                          {item.name} x{item.quantity}
                        </span>
                        <span style={{ color: theme.textDark }}>{item.subtotal} €</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <span style={{ color: theme.textDark }}>Sous-total produits :</span> {lastOrder.product.subtotal} €
              </div>
              <div>
                <span style={{ color: theme.textDark }}>Livraison :</span> {lastOrder.product.shipping} € ({lastOrder.shipping?.shortLabel || 'Mode non renseigne'})
              </div>
              <div>
                <span style={{ color: theme.textDark }}>Total paye :</span> {lastOrder.product.total} €
              </div>
              <div>
                <span style={{ color: theme.textDark }}>Paiement :</span> {lastOrder.paymentMethod}
              </div>
              {lastOrder.paypalOrderId && (
                <div>
                  <span style={{ color: theme.textDark }}>PayPal :</span> {lastOrder.paypalOrderId}
                </div>
              )}
              <div>
                <span style={{ color: theme.textDark }}>Client :</span> {lastOrder.address.firstName} {lastOrder.address.lastName} ({lastOrder.address.email})
              </div>
              <div>
                <span style={{ color: theme.textDark }}>Telephone :</span> {lastOrder.address.phone}
              </div>
              <div>
                <span style={{ color: theme.textDark }}>Adresse :</span> {lastOrder.address.street}, {lastOrder.address.zip} {lastOrder.address.city}, {lastOrder.address.country || 'France'}
              </div>
              <div>
                <span style={{ color: theme.textDark }}>Delai estime :</span> {lastOrder.shipping?.estimatedDelay || 'A confirmer'}
              </div>

              {lastOrder.customValues && Object.values(lastOrder.customValues).some(Boolean) && (
                <div>
                  <div style={{ color: theme.textDark, marginBottom: 6 }}>Personnalisation :</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {Object.entries(lastOrder.customValues)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ color: theme.textMid }}>{k}</span>
                          <span style={{ color: theme.textDark, fontStyle: 'italic' }}>{v}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
          <Link href="/" className="btn-gold" style={buttonGoldStyle()}>
            Retour à l'accueil
          </Link>
          <Link href="/catalogue" style={buttonOutlineGoldStyle()}>
            Continuer mes achats
          </Link>
        </div>

        {/* Decorative */}
        <div style={{ marginTop: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ height: 1, width: 80, background: 'linear-gradient(90deg, transparent, rgba(232,208,138,0.50))' }} />
          <span style={{ color: theme.goldLight, fontSize: 14 }}>✦</span>
          <div style={{ height: 1, width: 80, background: 'linear-gradient(270deg, transparent, rgba(232,208,138,0.50))' }} />
        </div>
      </div>
    </div>
  )
}
