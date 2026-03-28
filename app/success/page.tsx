/* eslint-disable react/no-unescaped-entities */
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { buttonGoldStyle, buttonOutlineGoldStyle, dividerStyle, fonts, theme } from '@/lib/uiStyles'

type LastOrder = {
  orderId: string
  paymentMethod: 'PAYPAL' | 'CARD'
  paypalOrderId?: string
  product: { id: string; name: string; categoryLabel?: string; unitPrice: string; quantity: number; total: string }
  customValues?: Record<string, string>
  address: {
    firstName: string
    lastName: string
    email: string
    street: string
    city: string
    zip: string
    country?: string
  }
}

export default function SuccessPage() {
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null)
  const [processingError, setProcessingError] = useState<string>('')
  const [orderEmailError, setOrderEmailError] = useState<string>('')

  useEffect(() => {
    try {
      const emailErr = sessionStorage.getItem('mm:orderEmailError')
      if (emailErr) {
        setOrderEmailError(emailErr)
        sessionStorage.removeItem('mm:orderEmailError')
      }

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
          Votre commande a bien été reçue et confirmée. Vous allez recevoir un email de confirmation avec le récapitulatif de votre commande.
        </p>

        {processingError && (
          <p style={{ color: '#ef4444', fontSize: 12, fontFamily: fonts.body, margin: '10px 0 0', lineHeight: 1.7 }}>
            {processingError}
          </p>
        )}

        {orderEmailError && (
          <p style={{ color: '#ef4444', fontSize: 12, fontFamily: fonts.body, margin: '10px 0 0', lineHeight: 1.7 }}>
            {orderEmailError}
          </p>
        )}

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
              <div>
                <span style={{ color: theme.textDark }}>Total :</span> {lastOrder.product.total} €
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
                <span style={{ color: theme.textDark }}>Adresse :</span> {lastOrder.address.street}, {lastOrder.address.zip} {lastOrder.address.city}, {lastOrder.address.country || 'France'}
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

        <p style={{ fontSize: 12, fontFamily: fonts.body, letterSpacing: '0.04em', marginBottom: 40, color: theme.gold }}>
          Délai de fabrication : 7 à 14 jours ouvrés
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
          <Link href="/" className="btn-gold" style={buttonGoldStyle()}>
            Retour à l'accueil
          </Link>
          <Link href="/category/plateaux" style={buttonOutlineGoldStyle()}>
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
