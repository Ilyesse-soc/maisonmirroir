'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getProductById } from '@/lib/products'
import PayPalButton from '@/components/PayPalButton'
import {
  buttonGoldStyle,
  buttonOutlineGoldStyle,
  dividerStyle,
  fonts,
  inputLuxuryStyle,
  pageMaxWidth,
  theme,
} from '@/lib/uiStyles'

export default function ProductPage() {
  const params = useParams()
  const product = getProductById(params.id as string)

  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [address, setAddress] = useState({ firstName: '', lastName: '', email: '', street: '', city: '', zip: '', country: 'France' })
  const [step, setStep] = useState<'customize' | 'address' | 'payment'>('customize')
  const [error, setError] = useState('')

  useEffect(() => {
    setSelectedImageIndex(0)
    setCustomValues({})
    setSelectedOptions({})
    setStep('customize')
    setError('')
  }, [params.id])

  if (!product)
    return (
      <div style={{ paddingTop: 128, textAlign: 'center', paddingBottom: 80, fontFamily: fonts.body }}>
        <p>Produit introuvable.</p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            marginTop: 16,
            color: theme.goldDark,
            textDecoration: 'underline',
          }}
        >
          Retour à l'accueil
        </Link>
      </div>
    )

  const handleCustomChange = (field: string, value: string) => {
    setCustomValues(prev => ({ ...prev, [field]: value }))
  }

  const handleAddressChange = (field: string, value: string) => {
    setAddress(prev => ({ ...prev, [field]: value }))
  }

  const quantity = 1
  const unitPrice = product.price
  const total = unitPrice * quantity
  const displayAmount = total.toFixed(2)

  const optionLabels: Record<string, string> = {
    boxColor: 'Couleur des boîtes',
    roseColor: 'Couleur des roses',
    decoration: 'Décoration',
    handles: 'Poignets',
    ringBoxes: 'Boîtes alliances',
    size: 'Taille',
    textColor: 'Couleur du texte',
    ringHolder: 'Support bague',
  }

  const optionEntries = Object.entries(product.options ?? {}).filter(([, values]) => Array.isArray(values) && values.length > 0)
  const optionsComplete = optionEntries.every(([key]) => Boolean(selectedOptions[key]))

  const formattedOptions: Record<string, string> = optionEntries.reduce((acc, [key]) => {
    const selected = selectedOptions[key]
    if (selected) acc[optionLabels[key] || key] = selected
    return acc
  }, {} as Record<string, string>)

  const mergedCustomValues: Record<string, string> = {
    ...formattedOptions,
    ...customValues,
  }

  const validateStep = () => {
    if (step === 'customize') {
      if (optionEntries.length > 0 && !optionsComplete) {
        setError('Veuillez sélectionner toutes les options de personnalisation.')
        return
      }
      setError('')
      setStep('address')
      return
    }
    if (step === 'address') {
      if (!address.firstName || !address.lastName || !address.email || !address.street || !address.city || !address.zip) {
        setError('Veuillez remplir tous les champs obligatoires.')
        return
      }
      setError('')
      setStep('payment')
    }
  }

  const steps = ['customize', 'address', 'payment']
  const stepIndex = steps.indexOf(step)

  const paypalClientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? '').trim()
  const paypalConfigured = paypalClientId.length > 0

  return (
    <div style={{ paddingTop: 80, minHeight: '100vh', background: theme.marble }}>
      <div style={{ maxWidth: pageMaxWidth, margin: '0 auto', padding: '64px 24px' }}>
        {/* Breadcrumb */}
        <nav
          style={{
            fontSize: 12,
            fontFamily: fonts.body,
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            marginBottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            color: theme.textMid,
          }}
        >
          <Link href="/" style={{ color: theme.textMid, textDecoration: 'none' }}>
            Accueil
          </Link>
          <span style={{ color: theme.gold }}>◈</span>
          <Link href={`/category/${product.category}`} style={{ color: theme.textMid, textDecoration: 'none' }}>
            {product.categoryLabel}
          </Link>
          <span style={{ color: theme.gold }}>◈</span>
          <span style={{ color: theme.textDark }}>{product.name}</span>
        </nav>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 56,
          }}
        >
          {/* LEFT: Image gallery */}
          <div>
            <div
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                background: 'white',
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}
            >
              <Image
                src={product.images[Math.min(Math.max(selectedImageIndex, 0), product.images.length - 1)]}
                alt={product.name}
                fill
                style={{ objectFit: 'cover' }}
                priority
              />
            </div>
            {product.images.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 12,
                  overflowX: 'auto',
                  paddingBottom: 4,
                }}
              >
                {product.images.map((img, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedImageIndex(i)}
                    style={{
                      position: 'relative',
                      aspectRatio: '1 / 1',
                      background: 'white',
                      overflow: 'hidden',
                      width: 88,
                      flex: '0 0 auto',
                      cursor: 'pointer',
                      border: `1px solid ${i === selectedImageIndex ? theme.gold : theme.creamDark}`,
                    }}
                    role="button"
                    aria-label={`Voir l'image ${i + 1}`}
                  >
                    <Image src={img} alt={`${product.name} ${i + 1}`} fill style={{ objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}

            {/* Features */}
            <div style={{ marginTop: 32, padding: 24, background: 'white', border: `1px solid ${theme.creamDark}` }}>
              <h4
                style={{
                  fontFamily: fonts.display,
                  fontSize: 14,
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  marginBottom: 16,
                  color: theme.gold,
                }}
              >
                Caractéristiques
              </h4>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 0, margin: 0, listStyle: 'none' }}>
                {product.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      fontSize: 12,
                      fontFamily: fonts.body,
                      letterSpacing: '0.04em',
                      color: theme.textMid,
                    }}
                  >
                    <span style={{ color: theme.gold }}>◇</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* RIGHT: Form */}
          <div>
            <p
              style={{
                fontFamily: fonts.display,
                fontSize: 12,
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                marginBottom: 8,
                color: theme.gold,
              }}
            >
              {product.categoryLabel}
            </p>
            <h1
              style={{
                fontFamily: fonts.display,
                fontSize: 'clamp(2rem, 4vw, 2.5rem)',
                fontWeight: 300,
                marginBottom: 12,
                color: theme.textDark,
              }}
            >
              {product.name}
            </h1>
            {typeof product.originalPrice === 'number' && product.originalPrice > unitPrice ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
                <span
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 14,
                    color: theme.textMid,
                    textDecoration: 'line-through',
                    letterSpacing: '0.06em',
                  }}
                >
                  {product.originalPrice.toFixed(2)} €
                </span>
                <span style={{ fontFamily: fonts.display, fontSize: 30, color: theme.gold }}>
                  {displayAmount} €
                </span>
                <span
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: theme.gold,
                    border: `1px solid ${theme.gold}`,
                    padding: '6px 10px',
                  }}
                >
                  -{Math.round((1 - unitPrice / product.originalPrice) * 100)}%
                </span>
              </div>
            ) : (
              <p style={{ fontFamily: fonts.display, fontSize: 26, marginBottom: 20, color: theme.gold }}>
                {displayAmount} €
              </p>
            )}
            <div style={{ ...dividerStyle(120), margin: '0 0 24px' }} />
            <p style={{ fontSize: 14, lineHeight: 1.9, fontFamily: fonts.body, letterSpacing: '0.04em', marginBottom: 32, color: theme.textMid }}>
              {product.description}
            </p>

            {/* Step progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
              {['Personnalisation', 'Livraison', 'Paiement'].map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      className="mm-step-circle"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontFamily: fonts.body,
                        background: i <= stepIndex ? theme.gold : 'transparent',
                        border: `1px solid ${i <= stepIndex ? theme.gold : '#d4b896'}`,
                        color: i <= stepIndex ? 'white' : theme.textMid,
                      }}
                    >
                      {i < stepIndex ? '✓' : i + 1}
                    </div>
                    <span
                      style={{
                        marginTop: 4,
                        fontFamily: fonts.body,
                        letterSpacing: '0.04em',
                        color: i <= stepIndex ? theme.gold : theme.textMid,
                        fontSize: 11,
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        margin: '0 4px',
                        background: i < stepIndex ? theme.gold : theme.goldLight,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* STEP 1: Customize */}
            {step === 'customize' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ fontFamily: fonts.display, fontSize: 20, fontWeight: 300, marginBottom: 8, color: theme.textDark }}>
                  Personnalisez votre création
                </h3>

                {optionEntries.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                    {optionEntries.map(([key, values]) => (
                      <div key={key}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 12,
                            letterSpacing: '0.20em',
                            textTransform: 'uppercase',
                            marginBottom: 8,
                            fontFamily: fonts.body,
                            color: theme.textMid,
                          }}
                        >
                          {optionLabels[key] || key} *
                        </label>
                        <select
                          className="mm-input"
                          style={inputLuxuryStyle}
                          value={selectedOptions[key] || ''}
                          onChange={(e) => setSelectedOptions((prev) => ({ ...prev, [key]: e.target.value }))}
                        >
                          <option value="" disabled>
                            Choisir...
                          </option>
                          {(values as string[]).map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {product.customFields.map((field) => (
                  <div key={field}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        letterSpacing: '0.20em',
                        textTransform: 'uppercase',
                        marginBottom: 8,
                        fontFamily: fonts.body,
                        color: theme.textMid,
                      }}
                    >
                      {field}
                    </label>
                    <input
                      type="text"
                      className="mm-input"
                      style={inputLuxuryStyle}
                      placeholder={`Votre ${field.toLowerCase()}...`}
                      value={customValues[field] || ''}
                      onChange={(e) => handleCustomChange(field, e.target.value)}
                    />
                  </div>
                ))}

                {error && <p style={{ color: '#ef4444', fontSize: 12, fontFamily: fonts.body }}>{error}</p>}
                <button className="btn-gold" onClick={validateStep} style={{ ...buttonGoldStyle({ fullWidth: true }), marginTop: 16 }}>
                  Continuer →
                </button>
              </div>
            )}

            {/* STEP 2: Address */}
            {step === 'address' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ fontFamily: fonts.display, fontSize: 20, fontWeight: 300, marginBottom: 8, color: theme.textDark }}>
                  Informations de livraison
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                      Prénom *
                    </label>
                    <input className="mm-input" type="text" style={inputLuxuryStyle} value={address.firstName} onChange={e => handleAddressChange('firstName', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                      Nom *
                    </label>
                    <input className="mm-input" type="text" style={inputLuxuryStyle} value={address.lastName} onChange={e => handleAddressChange('lastName', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                    Email *
                  </label>
                  <input className="mm-input" type="email" style={inputLuxuryStyle} value={address.email} onChange={e => handleAddressChange('email', e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                    Adresse *
                  </label>
                  <input className="mm-input" type="text" style={inputLuxuryStyle} value={address.street} onChange={e => handleAddressChange('street', e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                      Ville *
                    </label>
                    <input className="mm-input" type="text" style={inputLuxuryStyle} value={address.city} onChange={e => handleAddressChange('city', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                      Code postal *
                    </label>
                    <input className="mm-input" type="text" style={inputLuxuryStyle} value={address.zip} onChange={e => handleAddressChange('zip', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                    Pays
                  </label>
                  <input className="mm-input" type="text" style={inputLuxuryStyle} value={address.country} onChange={e => handleAddressChange('country', e.target.value)} />
                </div>
                {error && <p style={{ color: '#ef4444', fontSize: 12, fontFamily: fonts.body }}>{error}</p>}
                <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => setStep('customize')} style={{ ...buttonOutlineGoldStyle({ fullWidth: true }), flex: 1, minWidth: 220 }}>
                    ← Retour
                  </button>
                  <button className="btn-gold" onClick={validateStep} style={{ ...buttonGoldStyle({ fullWidth: true }), flex: 1, minWidth: 220 }}>
                    Continuer →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Payment */}
            {step === 'payment' && (
              <div>
                <h3
                  style={{
                    fontFamily: "'Cormorant Garamond',serif",
                    fontSize: '22px',
                    fontWeight: 300,
                    color: 'var(--text)',
                    marginBottom: '24px',
                  }}
                >
                  Récapitulatif & Paiement
                </h3>

                {/* ── ORDER CARD ── */}
                <div
                  style={{
                    background: 'white',
                    border: '1px solid #f0e6cc',
                    marginBottom: '20px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #1a1408, #2c200f)',
                      padding: '16px 22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Cormorant Garamond',serif",
                        fontSize: '13px',
                        letterSpacing: '0.3em',
                        textTransform: 'uppercase',
                        color: '#e8d08a',
                      }}
                    >
                      Votre commande
                    </span>
                    <span
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '10px',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.4)',
                      }}
                    >
                      Maison Miroir
                    </span>
                  </div>

                  {/* Product line */}
                  <div
                    style={{
                      padding: '18px 22px',
                      borderBottom: '1px solid #f5edd8',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontFamily: "'Cormorant Garamond',serif",
                          fontSize: '16px',
                          fontWeight: 400,
                          color: 'var(--text)',
                          marginBottom: '4px',
                        }}
                      >
                        {product.name}
                      </p>
                      <p
                        style={{
                          fontFamily: "'Jost',sans-serif",
                          fontSize: '10px',
                          letterSpacing: '0.2em',
                          textTransform: 'uppercase',
                          color: 'var(--gold)',
                        }}
                      >
                        {product.categoryLabel}
                      </p>
                    </div>
                    <span
                      style={{
                        fontFamily: "'Cormorant Garamond',serif",
                        fontSize: '18px',
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {displayAmount} €
                    </span>
                  </div>

                  {/* Personalization details */}
                  {Object.entries(customValues)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          padding: '10px 22px',
                          borderBottom: '1px solid #faf4e8',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Jost',sans-serif",
                            fontSize: '11px',
                            color: '#a08060',
                            letterSpacing: '0.08em',
                          }}
                        >
                          {k}
                        </span>
                        <span
                          style={{
                            fontFamily: "'Cormorant Garamond',serif",
                            fontSize: '14px',
                            color: 'var(--text)',
                            fontStyle: 'italic',
                          }}
                        >
                          {v}
                        </span>
                      </div>
                    ))}

                  {Object.entries(formattedOptions)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          padding: '10px 22px',
                          borderBottom: '1px solid #faf4e8',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Jost',sans-serif",
                            fontSize: '11px',
                            color: '#a08060',
                            letterSpacing: '0.08em',
                          }}
                        >
                          {k}
                        </span>
                        <span
                          style={{
                            fontFamily: "'Cormorant Garamond',serif",
                            fontSize: '14px',
                            color: 'var(--text)',
                            fontStyle: 'italic',
                          }}
                        >
                          {v}
                        </span>
                      </div>
                    ))}

                  {/* Delivery */}
                  <div
                    style={{
                      padding: '12px 22px',
                      borderBottom: '1px solid #f5edd8',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '11px',
                        color: '#a08060',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Livraison
                    </span>
                    <span
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '12px',
                        color: '#6a9a6a',
                        letterSpacing: '0.05em',
                      }}
                    >
                      ✓ Incluse
                    </span>
                  </div>

                  {/* Fabrication delay */}
                  <div
                    style={{
                      padding: '12px 22px',
                      borderBottom: '1px solid #f5edd8',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '11px',
                        color: '#a08060',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Délai de fabrication
                    </span>
                    <span
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '12px',
                        color: 'var(--mid)',
                        letterSpacing: '0.05em',
                      }}
                    >
                      7 – 14 jours ouvrés
                    </span>
                  </div>

                  {/* Total */}
                  <div
                    style={{
                      padding: '18px 22px',
                      background: 'linear-gradient(135deg, #fdf8ee, #faf2e0)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontFamily: "'Jost',sans-serif",
                          fontSize: '10px',
                          letterSpacing: '0.3em',
                          textTransform: 'uppercase',
                          color: 'var(--mid)',
                          marginBottom: '2px',
                        }}
                      >
                        Total TTC
                      </p>
                      <p
                        style={{
                          fontFamily: "'Jost',sans-serif",
                          fontSize: '10px',
                          color: '#b0966a',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Taxes incluses
                      </p>
                    </div>
                    <span
                      style={{
                        fontFamily: "'Cormorant Garamond',serif",
                        fontSize: '32px',
                        fontWeight: 400,
                        color: 'var(--gold)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {displayAmount} €
                    </span>
                  </div>
                </div>

                {/* ── SECURE BADGE ── */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 0',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontFamily: "'Jost',sans-serif",
                      fontSize: '11px',
                      color: 'var(--mid)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>🔒</span>
                    <span>Paiement 100% sécurisé</span>
                  </div>
                  {/* Payment icons */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                    }}
                  >
                    {['Visa', 'Mastercard', 'PayPal', 'Amex'].map((brand) => (
                      <div
                        key={brand}
                        style={{
                          background: 'white',
                          border: '1px solid #e8d8b0',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          fontFamily: "'Jost',sans-serif",
                          fontSize: '10px',
                          fontWeight: 500,
                          color: 'var(--mid)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {brand}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── PAYPAL BUTTON ── */}
                <div
                  style={{
                    border: '1px solid #f0e6cc',
                    padding: '20px',
                    background: 'white',
                    marginBottom: '14px',
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'Cormorant Garamond',serif",
                      fontSize: '15px',
                      fontWeight: 300,
                      color: 'var(--mid)',
                      textAlign: 'center',
                      marginBottom: '16px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Choisissez votre mode de paiement
                  </p>

                  {!paypalConfigured ? (
                    <p style={{ fontFamily: fonts.body, fontSize: 12, color: theme.textMid, lineHeight: 1.7, margin: 0, textAlign: 'center' }}>
                      Configuration requise : définis NEXT_PUBLIC_PAYPAL_CLIENT_ID dans .env.local.
                    </p>
                  ) : (
                    <PayPalButton
                      amount={total}
                      order={{
                        product: {
                          id: product.id,
                          name: product.name,
                          category: product.category,
                          categoryLabel: product.categoryLabel,
                          unitPrice,
                          quantity,
                        },
                        customValues: mergedCustomValues,
                        customer: address,
                      }}
                    />
                  )}
                </div>

                {error && (
                  <p style={{ color: '#ef4444', fontSize: 12, fontFamily: fonts.body, marginTop: 10, textAlign: 'center' }}>
                    {error}
                  </p>
                )}

                {/* ── BACK BUTTON ── */}
                <button className="btn-outline-gold" style={{ width: '100%', marginTop: '8px' }} onClick={() => setStep('address')}>
                  ← Modifier la commande
                </button>

                {/* ── REASSURANCE ── */}
                <div
                  style={{
                    marginTop: '20px',
                    padding: '16px',
                    background: 'linear-gradient(135deg, #fdf8ee, #faf2e0)',
                    border: '1px solid #f0e6cc',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                  }}
                >
                  {[
                    { icon: '✦', text: 'Pièce unique fabriquée à la main' },
                    { icon: '◈', text: 'Emballage cadeau luxe inclus' },
                    { icon: '◇', text: 'Gravure laser haute précision' },
                    { icon: '↩', text: 'Service client disponible 7j/7' },
                  ].map(({ icon, text }) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: 'var(--gold)', fontSize: '12px', marginTop: '1px', flexShrink: 0 }}>{icon}</span>
                      <span
                        style={{
                          fontFamily: "'Jost',sans-serif",
                          fontSize: '10px',
                          color: 'var(--mid)',
                          lineHeight: '1.6',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
