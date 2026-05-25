'use client'

import { useEffect, useMemo, useState } from 'react'
import { fonts, pageMaxWidth, theme } from '@/lib/uiStyles'
import type { OrderRecord, OrderStatus } from '@/lib/orderTypes'

const STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'En attente', label: 'En attente' },
  { value: 'Payee', label: 'Payee' },
  { value: 'En preparation', label: 'En preparation' },
  { value: 'Expediee', label: 'Expediee' },
  { value: 'Livree', label: 'Livree' },
  { value: 'Annulee', label: 'Annulee' },
]

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<string>('')

  const hasOrders = useMemo(() => orders.length > 0, [orders])

  const loadOrders = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/orders', { cache: 'no-store' })
      const data = (await res.json()) as { orders?: OrderRecord[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'Chargement impossible')
      setOrders(Array.isArray(data.orders) ? data.orders : [])
    } catch (e) {
      setError('Impossible de charger les commandes admin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const updateOrder = async (orderId: string, patch: { status?: OrderStatus; trackingNumber?: string }) => {
    setPending(orderId)
    setError('')
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = (await res.json()) as { order?: OrderRecord; error?: string }
      if (!res.ok || !data.order) throw new Error(data.error || 'Mise a jour impossible')

      setOrders((prev) => prev.map((item) => (item.orderId === data.order?.orderId ? data.order : item)))
    } catch {
      setError('La mise a jour a echoue.')
    } finally {
      setPending('')
    }
  }

  return (
    <div style={{ paddingTop: 88, minHeight: '100vh', background: theme.marble }}>
      <div style={{ maxWidth: pageMaxWidth, margin: '0 auto', padding: '40px 24px 72px' }}>
        <h1
          style={{
            fontFamily: fonts.display,
            fontSize: 'clamp(2rem, 4vw, 2.6rem)',
            fontWeight: 300,
            color: theme.textDark,
            marginBottom: 8,
          }}
        >
          Admin commandes
        </h1>
        <p style={{ margin: '0 0 24px', fontFamily: fonts.body, color: theme.textMid, letterSpacing: '0.04em' }}>
          Suivi des commandes, statut et numero de suivi.
        </p>

        {loading && <p style={{ fontFamily: fonts.body, color: theme.textMid }}>Chargement...</p>}
        {error && <p style={{ color: '#dc2626', fontFamily: fonts.body }}>{error}</p>}

        {!loading && !hasOrders && (
          <div style={{ background: 'white', border: `1px solid ${theme.creamDark}`, padding: 20, fontFamily: fonts.body, color: theme.textMid }}>
            Aucune commande pour le moment.
          </div>
        )}

        <div style={{ display: 'grid', gap: 16 }}>
          {orders.map((order) => (
            <div key={order.orderId} style={{ background: 'white', border: `1px solid ${theme.creamDark}`, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                <div>
                  <p style={{ margin: 0, fontFamily: fonts.body, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: theme.gold }}>
                    Commande #{order.orderId}
                  </p>
                  <p style={{ margin: '6px 0 0', fontFamily: fonts.body, color: theme.textMid, fontSize: 12 }}>
                    {new Date(order.orderDate).toLocaleString('fr-FR')}
                  </p>
                </div>
                <div style={{ fontFamily: fonts.body, color: theme.textDark, fontSize: 13 }}>
                  Total: {order.total.toFixed(2)} EUR
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div style={{ fontFamily: fonts.body, fontSize: 13, color: theme.textMid, lineHeight: 1.6 }}>
                  <div><strong style={{ color: theme.textDark }}>Client:</strong> {order.customer.firstName} {order.customer.lastName}</div>
                  <div><strong style={{ color: theme.textDark }}>Email:</strong> {order.customer.email}</div>
                  <div><strong style={{ color: theme.textDark }}>Telephone:</strong> {order.customer.phone}</div>
                  <div><strong style={{ color: theme.textDark }}>Adresse:</strong> {order.customer.street}, {order.customer.zip} {order.customer.city}, {order.customer.country || 'France'}</div>
                </div>

                <div style={{ fontFamily: fonts.body, fontSize: 13, color: theme.textMid, lineHeight: 1.6 }}>
                  <div><strong style={{ color: theme.textDark }}>Livraison:</strong> {order.shipping.label}</div>
                  <div><strong style={{ color: theme.textDark }}>Prix livraison:</strong> {order.shipping.price.toFixed(2)} EUR</div>
                  <div><strong style={{ color: theme.textDark }}>Delai estime:</strong> {order.shipping.estimatedDelay}</div>
                  <div><strong style={{ color: theme.textDark }}>Sous-total:</strong> {order.subtotal.toFixed(2)} EUR</div>
                  <div><strong style={{ color: theme.textDark }}>Statut actuel:</strong> {order.status}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: fonts.body, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.textMid, marginBottom: 6 }}>
                    Changer statut
                  </label>
                  <select
                    style={{ width: '100%', padding: '11px 12px', border: `1px solid ${theme.creamDark}`, background: '#fff' }}
                    value={order.status}
                    onChange={(e) => updateOrder(order.orderId, { status: e.target.value as OrderStatus })}
                    disabled={pending === order.orderId}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <TrackingEditor
                  order={order}
                  pending={pending === order.orderId}
                  onSave={(trackingNumber) => updateOrder(order.orderId, { trackingNumber })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TrackingEditor({
  order,
  pending,
  onSave,
}: {
  order: OrderRecord
  pending: boolean
  onSave: (tracking: string) => void
}) {
  const [tracking, setTracking] = useState(order.trackingNumber || '')

  useEffect(() => {
    setTracking(order.trackingNumber || '')
  }, [order.trackingNumber])

  return (
    <div>
      <label style={{ display: 'block', fontFamily: fonts.body, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.textMid, marginBottom: 6 }}>
        Numero de suivi
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Ex: 8X12345678901"
          style={{ flex: 1, padding: '11px 12px', border: `1px solid ${theme.creamDark}` }}
          disabled={pending}
        />
        <button
          onClick={() => onSave(tracking)}
          disabled={pending || tracking.trim().length < 4}
          style={{
            border: `1px solid ${theme.gold}`,
            color: pending ? '#8f8f8f' : theme.goldDark,
            background: 'white',
            padding: '11px 14px',
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          Enregistrer
        </button>
      </div>
      {order.trackingUrl && (
        <a href={order.trackingUrl} target="_blank" rel="noreferrer" style={{ fontFamily: fonts.body, fontSize: 12, color: theme.goldDark, marginTop: 8, display: 'inline-block' }}>
          Ouvrir le lien de suivi
        </a>
      )}
    </div>
  )
}
