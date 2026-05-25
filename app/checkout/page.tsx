'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import CartCheckoutButton from '@/components/CartCheckoutButton'
import { useCart } from '@/components/CartProvider'
import { SHIPPING_METHODS } from '@/lib/shipping'
import { getCartSubtotal, getCartTotal } from '@/lib/cart'
import { buttonOutlineGoldStyle, dividerStyle, fonts, pageMaxWidth, theme } from '@/lib/uiStyles'

export default function CheckoutPage() {
  const { items, shippingMethodId, setShippingMethodId } = useCart()
  const [address, setAddress] = useState({ firstName: '', lastName: '', email: '', phone: '', street: '', city: '', zip: '', country: 'France' })

  const selectedShipping = useMemo(
    () => SHIPPING_METHODS.find((method) => method.id === shippingMethodId) || SHIPPING_METHODS[0],
    [shippingMethodId],
  )

  const subtotal = getCartSubtotal(items)
  const total = getCartTotal(items, selectedShipping.id)

  if (items.length === 0) {
    return (
      <div style={{ paddingTop: 110, minHeight: '100vh', background: theme.marble }}>
        <div style={{ maxWidth: pageMaxWidth, margin: '0 auto', padding: '48px 24px 80px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: fonts.display, fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 300, color: theme.textDark }}>
            Votre panier est vide
          </h1>
          <p style={{ fontFamily: fonts.body, color: theme.textMid, lineHeight: 1.8 }}>Ajoutez au moins un produit avant de passer au paiement.</p>
          <Link href="/catalogue" className="btn-gold" style={{ ...buttonOutlineGoldStyle({ fullWidth: false }), textDecoration: 'none', display: 'inline-block' }}>
            Retour au catalogue
          </Link>
        </div>
      </div>
    )
  }

  const handleChange = (field: keyof typeof address, value: string) => {
    setAddress((previous) => ({ ...previous, [field]: value }))
  }

  return (
    <div className="mm-checkout-shell" style={{ paddingTop: 88, minHeight: '100vh', background: theme.marble }}>
      <div style={{ maxWidth: pageMaxWidth, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontFamily: fonts.body, fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: theme.gold, marginBottom: 8 }}>
            Checkout
          </p>
          <h1 className="mm-checkout-title" style={{ fontFamily: fonts.display, fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 300, color: theme.textDark, margin: 0 }}>
            Finaliser votre commande
          </h1>
        </div>

        <div className="mm-checkout-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: 28 }}>
          <section className="mm-checkout-stack" style={{ display: 'grid', gap: 18 }}>
            <div className="mm-checkout-card" style={{ background: 'white', border: `1px solid ${theme.creamDark}`, padding: 20 }}>
              <h2 style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 300, margin: 0, color: theme.textDark }}>
                Informations client
              </h2>
              <div style={{ ...dividerStyle(80), margin: '16px 0 18px' }} />
              <div style={{ display: 'grid', gap: 14 }}>
                <Field label="Prénom *" value={address.firstName} onChange={(value) => handleChange('firstName', value)} />
                <Field label="Nom *" value={address.lastName} onChange={(value) => handleChange('lastName', value)} />
                <Field label="Email *" value={address.email} type="email" onChange={(value) => handleChange('email', value)} />
                <Field label="Téléphone *" value={address.phone} type="tel" onChange={(value) => handleChange('phone', value)} />
                <Field label="Adresse *" value={address.street} onChange={(value) => handleChange('street', value)} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                  <Field label="Ville *" value={address.city} onChange={(value) => handleChange('city', value)} />
                  <Field label="Code postal *" value={address.zip} onChange={(value) => handleChange('zip', value)} />
                </div>
                <Field label="Pays" value={address.country} onChange={(value) => handleChange('country', value)} />
              </div>
            </div>

            <div className="mm-checkout-card" style={{ background: 'white', border: `1px solid ${theme.creamDark}`, padding: 20 }}>
              <h2 style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 300, margin: 0, color: theme.textDark }}>
                Livraison
              </h2>
              <div style={{ ...dividerStyle(80), margin: '16px 0 18px' }} />
              <div style={{ display: 'grid', gap: 10 }}>
                {SHIPPING_METHODS.map((method) => {
                  const checked = shippingMethodId === method.id
                  return (
                    <label
                      key={method.id}
                      style={{
                        border: `1px solid ${checked ? theme.gold : theme.creamDark}`,
                        background: checked ? '#fffaf0' : 'white',
                        padding: '12px 14px',
                        cursor: 'pointer',
                        display: 'grid',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="radio" checked={checked} onChange={() => setShippingMethodId(method.id)} />
                        <span style={{ fontFamily: fonts.body, fontSize: 13, color: theme.textDark }}>
                          {method.shortLabel} - {method.price.toFixed(2)} €
                        </span>
                      </div>
                      <span style={{ fontFamily: fonts.body, fontSize: 11, color: theme.textMid, marginLeft: 24 }}>
                        Délai estimé: {method.estimatedDelay}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </section>

          <aside className="mm-checkout-aside" style={{ background: 'white', border: `1px solid ${theme.creamDark}`, padding: 20, height: 'fit-content', position: 'sticky', top: 108 }}>
            <h2 style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 300, margin: 0, color: theme.textDark }}>
              Récapitulatif
            </h2>
            <div style={{ ...dividerStyle(80), margin: '16px 0 18px' }} />

            <div className="mm-checkout-stack" style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
              {items.map((item) => (
                <div key={item.key} className="mm-checkout-summary-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: fonts.body, fontSize: 13, color: theme.textMid }}>
                  <div>
                    <div style={{ color: theme.textDark }}>{item.name}</div>
                    {item.variantLabel && <div style={{ fontSize: 11, marginTop: 3 }}>{item.variantLabel}</div>}
                    <div style={{ fontSize: 11, marginTop: 3 }}>x{item.quantity}</div>
                  </div>
                  <div style={{ color: theme.textDark }}>{(item.unitPrice * item.quantity).toFixed(2)} €</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 12, fontFamily: fonts.body, fontSize: 13, color: theme.textMid }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Sous-total produits</span>
                <span>{subtotal.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Livraison</span>
                <span>{selectedShipping.price.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fonts.display, fontSize: 18, color: theme.textDark }}>
                <span>Total TTC</span>
                <span>{total.toFixed(2)} €</span>
              </div>
            </div>

            <div style={{ ...dividerStyle(100), margin: '18px 0' }} />

            <div className="mm-checkout-actions">
              <CartCheckoutButton items={items} customer={address} shippingMethod={selectedShipping} />
            </div>

            <div className="mm-checkout-actions" style={{ marginTop: 16 }}>
              <Link href="/panier" style={{ ...buttonOutlineGoldStyle({ fullWidth: true }), textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                Retour au panier
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <span style={{ fontFamily: fonts.body, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.textMid }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ padding: '12px 14px', border: `1px solid ${theme.creamDark}`, background: 'white', fontFamily: fonts.body }}
      />
    </label>
  )
}
